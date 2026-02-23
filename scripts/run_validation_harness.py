"""
mARB Health - Real File Validation Harness

Runs batch validation for 837P and 835 files:
1) Parse files using the production parser scripts.
2) Aggregate parser quality metrics and reconciliation stats.
3) Optionally load parsed payloads using load_to_supabase.py logic.
4) Write one machine-readable JSON report.

Usage examples:
  python scripts/run_validation_harness.py --input-837 "C:/data/837" --input-835 "C:/data/835"
  python scripts/run_validation_harness.py --input-837 "C:/data/837" --input-835 "C:/data/835" --load
"""

import argparse
import json
import os
from datetime import datetime, timezone

from parse_837p import parse_837p_file
from parse_835 import parse_835_file
from pipeline_models import MATCH_STRATEGY_KEYS


VALID_EXTENSIONS = (".TXT", ".EDI", ".837", ".835", ".X12")


def _to_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def _new_match_summary():
    return {key: 0 for key in MATCH_STRATEGY_KEYS}


def _list_edi_files(path):
    if os.path.isfile(path):
        return [path]

    if not os.path.isdir(path):
        return []

    files = []
    for name in sorted(os.listdir(path)):
        full_path = os.path.join(path, name)
        if os.path.isfile(full_path) and name.upper().endswith(VALID_EXTENSIONS):
            files.append(full_path)
    return files


def _new_quality_bucket():
    return {
        "warnings": 0,
        "invalid_dates": 0,
        "unknown_adjustment_groups": [],
        "unknown_carc_codes": [],
        "unknown_clp_status_codes": [],
        "unknown_dtp_qualifiers": [],
        "unknown_ref_qualifiers": [],
        "unknown_diagnosis_qualifiers": [],
    }


def _aggregate_parse_summary(summary, quality_bucket):
    quality_bucket["warnings"] += len(summary.get("warnings", []))
    quality_bucket["invalid_dates"] += summary.get("invalid_dates", 0)

    for key in (
        "unknown_adjustment_groups",
        "unknown_carc_codes",
        "unknown_clp_status_codes",
        "unknown_dtp_qualifiers",
        "unknown_ref_qualifiers",
        "unknown_diagnosis_qualifiers",
    ):
        quality_bucket[key].extend(summary.get(key, []))


def _finalize_quality_bucket(quality_bucket):
    for key in (
        "unknown_adjustment_groups",
        "unknown_carc_codes",
        "unknown_clp_status_codes",
        "unknown_dtp_qualifiers",
        "unknown_ref_qualifiers",
        "unknown_diagnosis_qualifiers",
    ):
        quality_bucket[key] = sorted(set(quality_bucket[key]))
    return quality_bucket


def _parse_837_batch(path):
    files = _list_edi_files(path) if path else []
    parsed_payloads = []
    failures = []
    quality = _new_quality_bucket()
    total_claims = 0
    total_charge = 0.0
    claim_ids = set()

    for file_path in files:
        try:
            payload = parse_837p_file(file_path)
            parsed_payloads.append(payload)
            total_claims += payload.get("record_count", 0)
            _aggregate_parse_summary(payload.get("parse_summary", {}), quality)

            for claim_data in payload.get("claims", []):
                claim = claim_data.get("claim", {})
                claim_id = claim.get("claim_id")
                if claim_id:
                    claim_ids.add(str(claim_id).strip())
                total_charge += _to_float(claim.get("total_charge_amount"))
        except Exception as exc:
            failures.append({"file": file_path, "error": str(exc)})

    return {
        "files": files,
        "parsed_payloads": parsed_payloads,
        "failures": failures,
        "total_claims": total_claims,
        "total_charge_amount": round(total_charge, 2),
        "claim_ids": claim_ids,
        "quality": _finalize_quality_bucket(quality),
    }


def _parse_835_batch(path):
    files = _list_edi_files(path) if path else []
    parsed_payloads = []
    failures = []
    quality = _new_quality_bucket()
    total_payments = 0
    total_charge = 0.0
    total_paid = 0.0
    total_adjustments = 0.0
    clp01_ids = set()
    clp07_ids = set()

    for file_path in files:
        try:
            payload = parse_835_file(file_path)
            parsed_payloads.append(payload)
            total_payments += payload.get("record_count", 0)
            _aggregate_parse_summary(payload.get("parse_summary", {}), quality)

            for payment_data in payload.get("payments", []):
                payment = payment_data.get("payment", {})
                total_charge += _to_float(payment.get("total_charge_amount"))
                total_paid += _to_float(payment.get("paid_amount"))
                pcn = payment.get("patient_control_number")
                clp07 = payment.get("payer_claim_control_number")
                if pcn:
                    clp01_ids.add(str(pcn).strip())
                if clp07:
                    clp07_ids.add(str(clp07).strip())

                for adj in payment_data.get("adjustments", []):
                    total_adjustments += _to_float(adj.get("adjustment_amount"))
                for line in payment_data.get("service_lines", []):
                    for adj in line.get("adjustments", []):
                        total_adjustments += _to_float(adj.get("adjustment_amount"))
        except Exception as exc:
            failures.append({"file": file_path, "error": str(exc)})

    return {
        "files": files,
        "parsed_payloads": parsed_payloads,
        "failures": failures,
        "total_payments": total_payments,
        "total_charge_amount": round(total_charge, 2),
        "total_paid_amount": round(total_paid, 2),
        "total_adjustment_amount": round(total_adjustments, 2),
        "clp01_ids": clp01_ids,
        "clp07_ids": clp07_ids,
        "quality": _finalize_quality_bucket(quality),
    }


def _run_load_phase(parsed_837, parsed_835, org_id):
    try:
        from load_to_supabase import get_client, load_837_file, load_835_file
    except ModuleNotFoundError as exc:
        return {
            "enabled": False,
            "requested": True,
            "org_id": org_id,
            "error": (
                "Load phase skipped: missing dependency. "
                f"Install required package and retry with --load. Details: {exc}"
            ),
            "files_loaded_837": 0,
            "files_loaded_835": 0,
            "records_loaded_837": 0,
            "records_loaded_835": 0,
            "match_summary": _new_match_summary(),
            "reconciliation": {
                "total_charge_amount": 0.0,
                "total_paid_amount": 0.0,
                "total_adjustment_amount": 0.0,
            },
            "errors": [],
        }

    client = get_client()
    summary = {
        "enabled": True,
        "requested": True,
        "org_id": org_id,
        "files_loaded_837": 0,
        "files_loaded_835": 0,
        "records_loaded_837": 0,
        "records_loaded_835": 0,
        "match_summary": _new_match_summary(),
        "reconciliation": {
            "total_charge_amount": 0.0,
            "total_paid_amount": 0.0,
            "total_adjustment_amount": 0.0,
        },
        "errors": [],
    }

    for payload in parsed_837:
        result = load_837_file(client, payload, org_id=org_id)
        if result.get("skipped"):
            continue
        summary["files_loaded_837"] += 1
        summary["records_loaded_837"] += result.get("loaded", 0)
        summary["errors"].extend(result.get("errors", []))

    for payload in parsed_835:
        result = load_835_file(client, payload, org_id=org_id)
        if result.get("skipped"):
            continue
        summary["files_loaded_835"] += 1
        summary["records_loaded_835"] += result.get("loaded", 0)
        summary["errors"].extend(result.get("errors", []))
        for key in summary["match_summary"]:
            summary["match_summary"][key] += result.get("match_summary", {}).get(key, 0)
        for key in summary["reconciliation"]:
            summary["reconciliation"][key] += result.get("reconciliation", {}).get(key, 0.0)

    for key in summary["reconciliation"]:
        summary["reconciliation"][key] = round(summary["reconciliation"][key], 2)
    return summary


def _pct(numerator, denominator):
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 2)


def _evaluate_quality_gates(report, max_invalid_date_rate, max_unmatched_rate, max_parse_fail_rate):
    claims = report["parse_phase"]["837"]["claims_parsed"]
    payments = report["parse_phase"]["835"]["payments_parsed"]
    parse_files = report["parse_phase"]["837"]["files_found"] + report["parse_phase"]["835"]["files_found"]
    parse_fails = report["parse_phase"]["837"]["files_failed"] + report["parse_phase"]["835"]["files_failed"]

    invalid_dates = (
        report["parse_phase"]["837"]["quality"]["invalid_dates"]
        + report["parse_phase"]["835"]["quality"]["invalid_dates"]
    )
    total_records = claims + payments
    invalid_date_rate = _pct(invalid_dates, total_records)
    parse_fail_rate = _pct(parse_fails, parse_files)

    unmatched_rate = 0.0
    unmatched_count = 0
    if report["load_phase"].get("enabled"):
        unmatched_count = report["load_phase"]["match_summary"].get("unmatched", 0)
        unmatched_rate = _pct(unmatched_count, payments)

    checks = [
        {
            "name": "parse_file_fail_rate",
            "actual_pct": parse_fail_rate,
            "threshold_pct": max_parse_fail_rate,
            "passed": parse_fail_rate <= max_parse_fail_rate,
        },
        {
            "name": "invalid_date_rate",
            "actual_pct": invalid_date_rate,
            "threshold_pct": max_invalid_date_rate,
            "passed": invalid_date_rate <= max_invalid_date_rate,
        },
    ]

    if report["load_phase"].get("enabled"):
        checks.append(
            {
                "name": "unmatched_835_rate",
                "actual_pct": unmatched_rate,
                "threshold_pct": max_unmatched_rate,
                "passed": unmatched_rate <= max_unmatched_rate,
                "unmatched_count": unmatched_count,
            }
        )

    return {
        "status": "pass" if all(c["passed"] for c in checks) else "fail",
        "checks": checks,
    }


def build_report(
    input_837,
    input_835,
    run_load,
    org_id,
    max_invalid_date_rate,
    max_unmatched_rate,
    max_parse_fail_rate,
):
    parse_837 = _parse_837_batch(input_837)
    parse_835 = _parse_835_batch(input_835)

    direct_match_candidates = len(parse_837["claim_ids"].intersection(parse_835["clp01_ids"]))

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "input_837": input_837,
            "input_835": input_835,
            "load_enabled": run_load,
            "org_id": org_id,
        },
        "parse_phase": {
            "837": {
                "files_found": len(parse_837["files"]),
                "files_failed": len(parse_837["failures"]),
                "claims_parsed": parse_837["total_claims"],
                "total_charge_amount": parse_837["total_charge_amount"],
                "quality": parse_837["quality"],
                "failures": parse_837["failures"],
            },
            "835": {
                "files_found": len(parse_835["files"]),
                "files_failed": len(parse_835["failures"]),
                "payments_parsed": parse_835["total_payments"],
                "total_charge_amount": parse_835["total_charge_amount"],
                "total_paid_amount": parse_835["total_paid_amount"],
                "total_adjustment_amount": parse_835["total_adjustment_amount"],
                "quality": parse_835["quality"],
                "failures": parse_835["failures"],
            },
        },
        "crosswalk": {
            "unique_837_claim_ids": len(parse_837["claim_ids"]),
            "unique_835_clp01_ids": len(parse_835["clp01_ids"]),
            "unique_835_clp07_ids": len(parse_835["clp07_ids"]),
            "direct_clp01_matches": direct_match_candidates,
        },
        "load_phase": {"enabled": False},
    }

    if run_load:
        report["load_phase"] = _run_load_phase(
            parsed_837=parse_837["parsed_payloads"],
            parsed_835=parse_835["parsed_payloads"],
            org_id=org_id,
        )

    report["quality_gates"] = _evaluate_quality_gates(
        report=report,
        max_invalid_date_rate=max_invalid_date_rate,
        max_unmatched_rate=max_unmatched_rate,
        max_parse_fail_rate=max_parse_fail_rate,
    )

    return report


def main():
    parser = argparse.ArgumentParser(description="Run real-file validation harness for 837/835")
    parser.add_argument("--input-837", required=True, help="File or folder path for 837 files")
    parser.add_argument("--input-835", required=True, help="File or folder path for 835 files")
    parser.add_argument("--load", action="store_true", help="Also run DB load phase")
    parser.add_argument("--org-id", type=int, default=None, help="Optional org id for load phase")
    parser.add_argument(
        "--max-invalid-date-rate",
        type=float,
        default=2.0,
        help="Fail gate when invalid date rate exceeds this percent (default: 2.0)",
    )
    parser.add_argument(
        "--max-unmatched-rate",
        type=float,
        default=10.0,
        help="Fail gate when unmatched 835 rate exceeds this percent (default: 10.0; load mode only)",
    )
    parser.add_argument(
        "--max-parse-fail-rate",
        type=float,
        default=5.0,
        help="Fail gate when parse file fail rate exceeds this percent (default: 5.0)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output report path (defaults to reports/validation_report_<timestamp>.json)",
    )
    args = parser.parse_args()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_path = args.output or os.path.join(
        "reports",
        f"validation_report_{timestamp}.json",
    )
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    report = build_report(
        input_837=args.input_837,
        input_835=args.input_835,
        run_load=args.load,
        org_id=args.org_id,
        max_invalid_date_rate=args.max_invalid_date_rate,
        max_unmatched_rate=args.max_unmatched_rate,
        max_parse_fail_rate=args.max_parse_fail_rate,
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Validation report written: {output_path}")
    print(
        "Parse summary: "
        f"837 claims={report['parse_phase']['837']['claims_parsed']}, "
        f"835 payments={report['parse_phase']['835']['payments_parsed']}, "
        f"direct_clp01_matches={report['crosswalk']['direct_clp01_matches']}"
    )
    if args.load:
        print(
            "Load summary: "
            f"loaded_837={report['load_phase'].get('records_loaded_837', 0)}, "
            f"loaded_835={report['load_phase'].get('records_loaded_835', 0)}, "
            f"unmatched={report['load_phase'].get('match_summary', {}).get('unmatched', 0)}"
        )
        if report["load_phase"].get("error"):
            print(report["load_phase"]["error"])
    print(f"Quality gates: status={report['quality_gates']['status']}")


if __name__ == "__main__":
    main()
