"""
Train claim acceptance model from parsed 837 data + synthetic truth manifest.

This keeps training faithful to 837 claim structure and synthetic generation
ground truth labels.

Usage:
  python train_claim_acceptance_from_synthetic.py \
    --parsed-837 test_data/parsed_837p_all.json \
    --truth test_data/synthetic_truth_manifest.json \
    --model-out models/claim_acceptance_model_synth.joblib
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _load_json(path: str):
    with open(path, "r", encoding="utf-8") as fp:
        return json.load(fp)


def _core_837_present(claim: dict[str, Any]) -> bool:
    # Core identity from contract: claim_id (CLM01), charge (CLM02), filing (SBR09), payer loop.
    return bool(
        claim.get("claim_id")
        and claim.get("total_charge_amount") is not None
        and claim.get("claim_filing_indicator_code")
        and (claim.get("payer_id") or claim.get("payer_name"))
    )


def _flatten_837(parsed_payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for file_obj in parsed_payload:
        for claim_obj in file_obj.get("claims", []):
            claim = claim_obj.get("claim", {})
            if not _core_837_present(claim):
                continue

            lines = claim_obj.get("lines", [])
            diagnoses = claim_obj.get("diagnoses", [])
            dates_header = claim_obj.get("dates_header", [])
            references = claim_obj.get("references", [])

            total_charge = _safe_float(claim.get("total_charge_amount"))
            total_line_charges = sum(_safe_float(line.get("charge_amount")) for line in lines)
            primary_line = next((line for line in lines if line.get("procedure_code")), {})
            primary_dx = next((dx for dx in diagnoses if dx.get("diagnosis_code")), {})
            qualifiers = {str(d.get("date_qualifier") or "") for d in dates_header}

            rows.append(
                {
                    "claim_id": claim.get("claim_id"),
                    "claim_type": claim.get("claim_type") or "professional",
                    "payer_id": claim.get("payer_id") or "unknown",
                    "claim_filing_indicator_code": claim.get("claim_filing_indicator_code") or "unknown",
                    "facility_type_code": claim.get("facility_type_code") or "unknown",
                    "primary_procedure_code": primary_line.get("procedure_code") or "unknown",
                    "primary_diagnosis_code": primary_dx.get("diagnosis_code") or "unknown",
                    "total_charge_amount": total_charge,
                    "num_service_lines": len(lines),
                    "total_line_charges": total_line_charges,
                    "charge_matches_total": 1 if abs(total_line_charges - total_charge) < 0.01 else 0,
                    "num_diagnoses": len(diagnoses),
                    "has_prior_auth": 1 if any(ref.get("reference_qualifier") == "G1" for ref in references) else 0,
                    "has_service_date": 1 if "472" in qualifiers else 0,
                    "has_statement_dates": 1 if ("232" in qualifiers and "233" in qualifiers) else 0,
                    "missing_field_count": sum(
                        1
                        for required in [
                            claim.get("claim_id"),
                            claim.get("payer_id"),
                            claim.get("claim_filing_indicator_code"),
                        ]
                        if not required
                    ),
                }
            )
    return rows


def _make_pipeline(categorical_cols: list[str], numeric_cols: list[str]) -> Pipeline:
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    preprocess = ColumnTransformer(
        transformers=[
            ("categorical", categorical_transformer, categorical_cols),
            ("numeric", numeric_transformer, numeric_cols),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocess),
            ("model", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ]
    )


def main():
    parser = argparse.ArgumentParser(description="Train acceptance model from synthetic 837 truth.")
    parser.add_argument("--parsed-837", required=True, help="Path to parsed 837 output JSON.")
    parser.add_argument("--truth", required=True, help="Path to synthetic truth manifest JSON.")
    parser.add_argument(
        "--model-out",
        default="models/claim_acceptance_model_synth.joblib",
        help="Output model artifact path.",
    )
    parser.add_argument(
        "--metrics-out",
        default="models/claim_acceptance_model_synth_metrics.json",
        help="Output metrics path.",
    )
    args = parser.parse_args()

    parsed_payload = _load_json(args.parsed_837)
    truth_payload = _load_json(args.truth)

    parsed_rows = _flatten_837(parsed_payload)
    if not parsed_rows:
        raise RuntimeError("No valid 837 claim rows found in parsed payload.")

    truth_by_claim = {
        str(row["claim_id"]): int(row["accepted_first_pass"])
        for row in truth_payload
        if row.get("claim_id") is not None and row.get("accepted_first_pass") in (0, 1)
    }
    if not truth_by_claim:
        raise RuntimeError("Truth manifest does not contain usable accepted_first_pass labels.")

    frame = pd.DataFrame.from_records(parsed_rows)
    frame["accepted_label"] = frame["claim_id"].map(truth_by_claim)
    frame = frame.dropna(subset=["accepted_label"]).copy()
    frame["accepted_label"] = frame["accepted_label"].astype(int)
    if frame.empty:
        raise RuntimeError("No overlap between parsed 837 claims and truth manifest claim_id values.")
    if frame["accepted_label"].nunique() < 2:
        raise RuntimeError("Need both positive and negative classes in synthetic truth data.")

    categorical_cols = [
        "claim_type",
        "payer_id",
        "claim_filing_indicator_code",
        "facility_type_code",
        "primary_procedure_code",
        "primary_diagnosis_code",
    ]
    numeric_cols = [
        "total_charge_amount",
        "num_service_lines",
        "total_line_charges",
        "charge_matches_total",
        "num_diagnoses",
        "has_prior_auth",
        "has_service_date",
        "has_statement_dates",
        "missing_field_count",
    ]

    split_idx = int(len(frame) * 0.8)
    train_df = frame.iloc[:split_idx]
    test_df = frame.iloc[split_idx:]
    if test_df.empty:
        raise RuntimeError("Not enough rows for holdout split; generate more synthetic claims.")

    pipeline = _make_pipeline(categorical_cols, numeric_cols)
    X_train = train_df[categorical_cols + numeric_cols]
    y_train = train_df["accepted_label"]
    X_test = test_df[categorical_cols + numeric_cols]
    y_test = test_df["accepted_label"]

    pipeline.fit(X_train, y_train)
    probs = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "roc_auc": float(roc_auc_score(y_test, probs)),
        "average_precision": float(average_precision_score(y_test, probs)),
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
        "label_positive_rate": float(frame["accepted_label"].mean()),
    }

    model_version = f"logreg-synth837-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    bundle = {
        "model": pipeline,
        "model_version": model_version,
        "categorical_cols": categorical_cols,
        "numeric_cols": numeric_cols,
        "trained_at": datetime.now(UTC).isoformat(),
        "metrics": metrics,
        "training_source": "parsed_837_plus_synthetic_truth_manifest",
    }

    model_dir = os.path.dirname(args.model_out)
    metrics_dir = os.path.dirname(args.metrics_out)
    if model_dir:
        os.makedirs(model_dir, exist_ok=True)
    if metrics_dir:
        os.makedirs(metrics_dir, exist_ok=True)

    joblib.dump(bundle, args.model_out)
    with open(args.metrics_out, "w", encoding="utf-8") as fp:
        json.dump(
            {
                "model_version": model_version,
                "trained_at": bundle["trained_at"],
                "metrics": metrics,
                "training_source": bundle["training_source"],
            },
            fp,
            indent=2,
        )

    print(f"Saved model: {args.model_out}")
    print(f"Saved metrics: {args.metrics_out}")
    print(
        f"ROC AUC={metrics['roc_auc']:.4f}, "
        f"Average Precision={metrics['average_precision']:.4f}"
    )


if __name__ == "__main__":
    main()
