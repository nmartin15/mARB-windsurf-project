"""
Score claims for first-pass acceptance probability and write results to Supabase.

Usage:
    python score_claims.py [--org-id 1] [--claim-id 123] [--model-path models/claim_acceptance_model.joblib]
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
from dotenv import load_dotenv
from supabase import create_client

from ml_features import build_feature_frame


load_dotenv()


def get_client():
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not service_key:
        raise RuntimeError(
            "Supabase credentials are required (SUPABASE_URL/SUPABASE_SERVICE_KEY "
            "or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)."
        )
    return create_client(supabase_url, service_key)


def _risk_band(score: float) -> str:
    if score < 0.70:
        return "high"
    if score < 0.90:
        return "medium"
    return "low"


def _build_factors(row: dict[str, Any], score: float, model_version: str) -> dict[str, Any]:
    risk_flags: list[str] = []
    if float(row.get("missing_field_count", 0)) > 0:
        risk_flags.append("missing_required_fields")
    if float(row.get("payer_historical_denial_rate", 0)) >= 0.20:
        risk_flags.append("high_payer_denial_rate")
    if int(row.get("charge_matches_total", 1)) == 0:
        risk_flags.append("header_line_charge_mismatch")
    if int(row.get("has_service_date", 0)) == 0:
        risk_flags.append("missing_service_date")

    return {
        "model_version": model_version,
        "risk_band": _risk_band(score),
        "risk_flags": risk_flags,
        "top_inputs": {
            "payer_id": row.get("payer_id"),
            "claim_filing_indicator_code": row.get("claim_filing_indicator_code"),
            "primary_procedure_code": row.get("primary_procedure_code"),
            "primary_diagnosis_code": row.get("primary_diagnosis_code"),
            "payer_historical_denial_rate": row.get("payer_historical_denial_rate"),
            "missing_field_count": row.get("missing_field_count"),
        },
    }


def score_claim_ids(
    client,
    *,
    claim_header_ids: list[int],
    model_path: str = "models/claim_acceptance_model.joblib",
) -> int:
    if not claim_header_ids:
        return 0
    if not Path(model_path).exists():
        raise FileNotFoundError(f"Model artifact not found: {model_path}")

    bundle = joblib.load(model_path)
    model = bundle["model"]
    model_version = str(bundle.get("model_version", "unknown"))
    categorical_cols: list[str] = bundle["categorical_cols"]
    numeric_cols: list[str] = bundle["numeric_cols"]

    frame = build_feature_frame(client, claim_header_ids=claim_header_ids, include_labels=False)
    if frame.empty:
        return 0

    features = frame[categorical_cols + numeric_cols]
    probabilities = model.predict_proba(features)[:, 1]
    rows = frame.to_dict(orient="records")
    written = 0

    for row, score in zip(rows, probabilities):
        claim_id = int(row["claim_header_id"])
        score_value = float(score)
        factors = _build_factors(row, score_value, model_version)

        client.table("claim_headers").update(
            {
                "prediction_score": round(score_value, 4),
                "prediction_factors": factors,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }
        ).eq("id", claim_id).execute()

        client.table("prediction_history").insert(
            {
                "claim_header_id": claim_id,
                "prediction_score": round(score_value, 4),
                "prediction_factors": factors,
                "model_version": model_version,
            }
        ).execute()
        written += 1

    return written


def score_unscored_claims(
    *,
    org_id: int | None = None,
    claim_id: int | None = None,
    model_path: str = "models/claim_acceptance_model.joblib",
) -> int:
    client = get_client()
    query = client.table("claim_headers").select("id")
    if claim_id is not None:
        query = query.eq("id", claim_id)
    else:
        query = query.is_("prediction_score", "null")
    if org_id is not None:
        query = query.eq("org_id", org_id)

    rows = query.execute().data or []
    ids = [int(row["id"]) for row in rows]
    return score_claim_ids(client, claim_header_ids=ids, model_path=model_path)


def main():
    parser = argparse.ArgumentParser(description="Score claim acceptance probabilities.")
    parser.add_argument("--org-id", type=int, default=None, help="Optional organization filter.")
    parser.add_argument("--claim-id", type=int, default=None, help="Optional single claim ID.")
    parser.add_argument(
        "--model-path",
        default="models/claim_acceptance_model.joblib",
        help="Path to trained model artifact.",
    )
    args = parser.parse_args()

    total = score_unscored_claims(
        org_id=args.org_id,
        claim_id=args.claim_id,
        model_path=args.model_path,
    )
    print(f"Scored {total} claim(s)")


if __name__ == "__main__":
    main()
