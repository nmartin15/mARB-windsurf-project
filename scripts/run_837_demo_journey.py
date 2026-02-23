"""
Run a reproducible 837/835 demo journey end-to-end.

Flow:
1) Generate synthetic EDI files (837 + 835 + truth manifest).
2) Split raw files into 837 and 835 folders.
3) Parse 837 and 835 with production parsers.
4) Run validation harness over parsed corpus.
5) Train acceptance model from parsed 837 + truth manifest.
6) Optionally run DB load/score steps when canonical tables are available.

Usage:
  python scripts/run_837_demo_journey.py --claims 250 --days 10
  python scripts/run_837_demo_journey.py --claims 250 --days 10 --load-db --org-id 1
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


def _run_command(cmd: list[str], cwd: Path, env_overrides: dict[str, str] | None = None) -> dict[str, Any]:
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        shell=False,
        env=env,
    )
    return {
        "command": " ".join(cmd),
        "exit_code": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def _split_raw_files(raw_dir: Path, out_837: Path, out_835: Path) -> dict[str, int]:
    out_837.mkdir(parents=True, exist_ok=True)
    out_835.mkdir(parents=True, exist_ok=True)
    c837 = 0
    c835 = 0
    for file_path in raw_dir.glob("*.txt"):
        name = file_path.name.lower()
        if name.startswith("837p_"):
            shutil.copy2(file_path, out_837 / file_path.name)
            c837 += 1
        elif name.startswith("835_"):
            shutil.copy2(file_path, out_835 / file_path.name)
            c835 += 1
    return {"files_837": c837, "files_835": c835}


def _safe_read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def _db_load_possible() -> tuple[bool, str]:
    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not supabase_key:
        return False, "Missing Supabase credentials in environment."

    try:
        client = create_client(supabase_url, supabase_key)
        # Minimal preflight for canonical schema presence.
        _ = client.table("claim_headers").select("id").limit(1).execute()
        return True, "claim_headers table found."
    except Exception as exc:  # pragma: no cover - depends on external environment
        return False, f"DB preflight failed: {exc}"


def main():
    parser = argparse.ArgumentParser(description="Run end-to-end 837 demo journey.")
    parser.add_argument("--claims", type=int, default=250, help="Number of synthetic claims.")
    parser.add_argument("--days", type=int, default=10, help="Business days span for synthetic claims.")
    parser.add_argument(
        "--run-root",
        default="test_data/demo_journey",
        help="Root folder for generated/parsed demo artifacts.",
    )
    parser.add_argument("--load-db", action="store_true", help="Attempt DB load phase via validation harness.")
    parser.add_argument("--org-id", type=int, default=None, help="Optional org id for DB load phase.")
    parser.add_argument(
        "--apply-migrations",
        action="store_true",
        help="Attempt to apply canonical migrations before DB preflight/load.",
    )
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Env var name containing postgres URL for --apply-migrations.",
    )
    parser.add_argument(
        "--require-db-load",
        action="store_true",
        help="Mark run as failed if DB load cannot execute.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    run_id = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    run_root = (repo_root / args.run_root / run_id).resolve()
    raw_dir = run_root / "raw"
    raw_837_dir = run_root / "raw_837"
    raw_835_dir = run_root / "raw_835"
    parsed_837 = run_root / "parsed_837.json"
    parsed_835 = run_root / "parsed_835.json"
    validation_report = run_root / "validation_report.json"
    model_path = run_root / "claim_acceptance_model_synth.joblib"
    model_metrics = run_root / "claim_acceptance_model_synth_metrics.json"
    manifest_path = raw_dir / "synthetic_truth_manifest.json"
    final_report = run_root / "journey_report.json"

    run_root.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    steps: list[dict[str, Any]] = []
    migration_step: dict[str, Any] = {
        "requested": bool(args.apply_migrations),
        "executed": False,
        "exit_code": 0,
        "stdout": "Migration step not requested.",
        "stderr": "",
    }

    if args.apply_migrations:
        migration_cmd = [
            sys.executable,
            "scripts/apply_canonical_migrations.py",
            "--database-url-env",
            str(args.database_url_env),
        ]
        migration_exec = _run_command(migration_cmd, cwd=repo_root)
        migration_step = {
            "requested": True,
            "executed": True,
            "exit_code": migration_exec["exit_code"],
            "stdout": migration_exec["stdout"],
            "stderr": migration_exec["stderr"],
        }
        steps.append(migration_exec)

    steps.append(
        _run_command(
            [
                sys.executable,
                "scripts/generate_test_edi.py",
                "--claims",
                str(args.claims),
                "--days",
                str(args.days),
                "--outdir",
                str(raw_dir),
            ],
            cwd=repo_root,
        )
    )

    split_counts = _split_raw_files(raw_dir, raw_837_dir, raw_835_dir)

    steps.append(
        _run_command(
            [sys.executable, "scripts/parse_837p.py", str(raw_837_dir), "-o", str(parsed_837)],
            cwd=repo_root,
        )
    )
    steps.append(
        _run_command(
            [sys.executable, "scripts/parse_835.py", str(raw_835_dir), "-o", str(parsed_835)],
            cwd=repo_root,
        )
    )

    steps.append(
        _run_command(
            [
                sys.executable,
                "scripts/train_claim_acceptance_from_synthetic.py",
                "--parsed-837",
                str(parsed_837),
                "--truth",
                str(manifest_path),
                "--model-out",
                str(model_path),
                "--metrics-out",
                str(model_metrics),
            ],
            cwd=repo_root,
        )
    )

    can_load, load_reason = _db_load_possible() if args.load_db else (False, "DB load not requested.")
    load_flag = args.load_db and can_load

    harness_cmd = [
        sys.executable,
        "scripts/run_validation_harness.py",
        "--input-837",
        str(raw_837_dir),
        "--input-835",
        str(raw_835_dir),
        "--output",
        str(validation_report),
    ]
    harness_env: dict[str, str] | None = None
    if load_flag:
        harness_cmd.append("--load")
        if args.org_id is not None:
            harness_cmd.extend(["--org-id", str(args.org_id)])
        # Ensure loader scoring uses this run's model artifact.
        harness_env = {"CLAIM_ACCEPTANCE_MODEL_PATH": str(model_path)}
    steps.append(_run_command(harness_cmd, cwd=repo_root, env_overrides=harness_env))

    score_step = {
        "command": "python scripts/score_claims.py",
        "exit_code": 0,
        "stdout": "Skipped: DB load did not execute.",
        "stderr": "",
    }
    if load_flag:
        score_cmd = [
            sys.executable,
            "scripts/score_claims.py",
            "--model-path",
            str(model_path),
        ]
        if args.org_id is not None:
            score_cmd.extend(["--org-id", str(args.org_id)])
        score_step = _run_command(score_cmd, cwd=repo_root)
    steps.append(score_step)

    validation_json = _safe_read_json(validation_report)
    metrics_json = _safe_read_json(model_metrics)
    truth_json = _safe_read_json(manifest_path)
    total_truth = len(truth_json) if isinstance(truth_json, list) else 0
    truth_positive = (
        sum(1 for row in truth_json if row.get("accepted_first_pass") == 1)
        if isinstance(truth_json, list)
        else 0
    )

    status = "pass"
    if any(step["exit_code"] != 0 for step in steps):
        status = "fail"
    if validation_json.get("quality_gates", {}).get("status") == "fail":
        status = "fail"
    if args.require_db_load and not load_flag:
        status = "fail"
    if args.apply_migrations and migration_step["exit_code"] != 0:
        status = "fail"

    report = {
        "run_id": run_id,
        "generated_at": datetime.now(UTC).isoformat(),
        "status": status,
        "paths": {
            "run_root": str(run_root),
            "raw_dir": str(raw_dir),
            "raw_837_dir": str(raw_837_dir),
            "raw_835_dir": str(raw_835_dir),
            "parsed_837": str(parsed_837),
            "parsed_835": str(parsed_835),
            "truth_manifest": str(manifest_path),
            "validation_report": str(validation_report),
            "model_path": str(model_path),
            "model_metrics": str(model_metrics),
        },
        "dataset": {
            "claims_requested": args.claims,
            "days_requested": args.days,
            "raw_837_files": split_counts["files_837"],
            "raw_835_files": split_counts["files_835"],
            "truth_rows": total_truth,
            "truth_positive_rows": truth_positive,
            "truth_positive_rate_pct": round((truth_positive / total_truth) * 100.0, 2) if total_truth else 0.0,
        },
        "db_load": {
            "requested": bool(args.load_db),
            "required": bool(args.require_db_load),
            "executed": bool(load_flag),
            "reason": load_reason,
        },
        "migration": migration_step,
        "validation_summary": {
            "quality_gate_status": validation_json.get("quality_gates", {}).get("status"),
            "claims_parsed": validation_json.get("parse_phase", {}).get("837", {}).get("claims_parsed"),
            "payments_parsed": validation_json.get("parse_phase", {}).get("835", {}).get("payments_parsed"),
            "direct_clp01_matches": validation_json.get("crosswalk", {}).get("direct_clp01_matches"),
        },
        "model_summary": {
            "model_version": metrics_json.get("model_version"),
            "metrics": metrics_json.get("metrics", {}),
        },
        "scoring_summary": {
            "executed": bool(load_flag),
            "command_exit_code": score_step.get("exit_code"),
            "stdout": score_step.get("stdout", ""),
            "stderr": score_step.get("stderr", ""),
        },
        "steps": steps,
    }

    with final_report.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2)

    print(f"Demo journey report written: {final_report}")
    print(f"Status: {status}")
    print(
        "Parsed summary: "
        f"claims={report['validation_summary']['claims_parsed']}, "
        f"payments={report['validation_summary']['payments_parsed']}, "
        f"direct_matches={report['validation_summary']['direct_clp01_matches']}"
    )
    metrics = report["model_summary"]["metrics"]
    if metrics:
        print(
            "Model metrics: "
            f"roc_auc={metrics.get('roc_auc')}, "
            f"avg_precision={metrics.get('average_precision')}"
        )


if __name__ == "__main__":
    main()
