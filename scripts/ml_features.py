"""
Feature extraction helpers for claim acceptance prediction.

This module builds training/inference feature frames from the canonical
claim tables in Supabase.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

import pandas as pd


ACCEPTED_STATUSES = {"paid", "partial", "accepted"}
NOT_ACCEPTED_STATUSES = {"denied", "rejected"}


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _is_truthy(value: Any) -> int:
    return 1 if value else 0


def _chunked(values: list[int], size: int = 500) -> Iterable[list[int]]:
    for idx in range(0, len(values), size):
        yield values[idx : idx + size]


def _query_related_rows(client, table_name: str, claim_ids: list[int]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for chunk in _chunked(claim_ids):
        response = (
            client.table(table_name)
            .select("*")
            .in_("claim_header_id", chunk)
            .execute()
        )
        rows.extend(response.data or [])
    return rows


def _build_label(claim_status: str | None) -> int | None:
    if claim_status in ACCEPTED_STATUSES:
        return 1
    if claim_status in NOT_ACCEPTED_STATUSES:
        return 0
    return None


def build_feature_frame(
    client,
    *,
    claim_header_ids: list[int] | None = None,
    org_id: int | None = None,
    include_labels: bool = False,
) -> pd.DataFrame:
    """
    Build a pandas DataFrame of model features for claim headers.

    include_labels=True returns an `accepted_label` column for supervised training.
    """
    query = client.table("claim_headers").select("*")
    if claim_header_ids:
        query = query.in_("id", claim_header_ids)
    if org_id is not None:
        query = query.eq("org_id", org_id)

    headers = query.execute().data or []
    if not headers:
        return pd.DataFrame()

    claim_ids = [int(row["id"]) for row in headers]
    lines = _query_related_rows(client, "claim_lines", claim_ids)
    diagnoses = _query_related_rows(client, "claim_diagnoses", claim_ids)
    dates = _query_related_rows(client, "claim_dates", claim_ids)

    lines_by_claim: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in lines:
        lines_by_claim[int(row["claim_header_id"])].append(row)

    dx_by_claim: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in diagnoses:
        dx_by_claim[int(row["claim_header_id"])].append(row)

    dates_by_claim: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in dates:
        dates_by_claim[int(row["claim_header_id"])].append(row)

    payer_rows = (
        client.table("claim_headers")
        .select("payer_id, claim_status")
        .not_("payer_id", "is", None)
        .execute()
        .data
        or []
    )
    payer_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "denied": 0})
    for row in payer_rows:
        payer_id = str(row.get("payer_id") or "").strip()
        if not payer_id:
            continue
        payer_stats[payer_id]["total"] += 1
        if row.get("claim_status") in NOT_ACCEPTED_STATUSES:
            payer_stats[payer_id]["denied"] += 1

    records: list[dict[str, Any]] = []
    for header in headers:
        claim_id = int(header["id"])
        claim_lines = lines_by_claim.get(claim_id, [])
        claim_dx = dx_by_claim.get(claim_id, [])
        claim_dates = dates_by_claim.get(claim_id, [])

        total_line_charges = sum(_safe_float(line.get("charge_amount")) for line in claim_lines)
        header_charge = _safe_float(header.get("total_charge_amount"))
        primary_line = next(
            (
                line
                for line in sorted(claim_lines, key=lambda row: int(row.get("line_number") or 10_000))
                if line.get("procedure_code")
            ),
            None,
        )
        primary_dx = next(
            (
                dx
                for dx in sorted(claim_dx, key=lambda row: int(row.get("sequence_number") or 10_000))
                if dx.get("diagnosis_code")
            ),
            None,
        )

        qualifiers = {str(row.get("date_qualifier") or "") for row in claim_dates}
        required_fields = [
            header.get("claim_id"),
            header.get("payer_id"),
            header.get("claim_filing_indicator_code"),
            header.get("claim_type"),
        ]
        missing_field_count = sum(1 for field in required_fields if not field)

        payer_id = str(header.get("payer_id") or "").strip()
        payer_denial_rate = 0.0
        if payer_id and payer_stats[payer_id]["total"] > 0:
            payer_denial_rate = payer_stats[payer_id]["denied"] / payer_stats[payer_id]["total"]

        record = {
            "claim_header_id": claim_id,
            "created_at": header.get("created_at"),
            "claim_type": header.get("claim_type") or "unknown",
            "payer_id": payer_id or "unknown",
            "claim_filing_indicator_code": header.get("claim_filing_indicator_code") or "unknown",
            "facility_type_code": header.get("facility_type_code") or "unknown",
            "primary_procedure_code": (primary_line or {}).get("procedure_code") or "unknown",
            "primary_diagnosis_code": (primary_dx or {}).get("diagnosis_code") or "unknown",
            "total_charge_amount": header_charge,
            "num_service_lines": len(claim_lines),
            "total_line_charges": total_line_charges,
            "charge_matches_total": _is_truthy(abs(total_line_charges - header_charge) < 0.01),
            "num_diagnoses": len(claim_dx),
            "has_admitting_dx": _is_truthy(any(dx.get("diagnosis_type") == "admitting" for dx in claim_dx)),
            "has_prior_auth": _is_truthy(header.get("prior_auth_number")),
            "has_service_date": _is_truthy("472" in qualifiers),
            "has_statement_dates": _is_truthy("232" in qualifiers and "233" in qualifiers),
            "missing_field_count": missing_field_count,
            "payer_historical_denial_rate": payer_denial_rate,
        }
        if include_labels:
            record["accepted_label"] = _build_label(header.get("claim_status"))
            record["claim_status"] = header.get("claim_status")
        records.append(record)

    frame = pd.DataFrame.from_records(records)
    return frame.sort_values("created_at").reset_index(drop=True)
