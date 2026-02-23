"""
Train a first-pass claim acceptance model.

Usage:
    python train_claim_acceptance_model.py [--org-id 1] [--model-out models/claim_acceptance_model.joblib]
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

import joblib

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


def train_model(org_id: int | None = None):
    client = get_client()
    frame = build_feature_frame(client, org_id=org_id, include_labels=True)
    if frame.empty:
        raise RuntimeError("No claims found for training.")

    frame = frame.dropna(subset=["accepted_label"]).copy()
    if frame.empty:
        raise RuntimeError("No labeled claims available. Need denied/rejected and paid/accepted outcomes.")

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
        "has_admitting_dx",
        "has_prior_auth",
        "has_service_date",
        "has_statement_dates",
        "missing_field_count",
        "payer_historical_denial_rate",
    ]

    frame["created_at"] = frame["created_at"].fillna("1970-01-01T00:00:00Z")
    frame = frame.sort_values("created_at")

    cutoff_idx = int(len(frame) * 0.8)
    train_df = frame.iloc[:cutoff_idx]
    test_df = frame.iloc[cutoff_idx:]

    if train_df["accepted_label"].nunique() < 2 or test_df["accepted_label"].nunique() < 2:
        raise RuntimeError("Need at least two classes in train/test split. Add more labeled data.")

    pipeline = _make_pipeline(categorical_cols, numeric_cols)
    X_train = train_df[categorical_cols + numeric_cols]
    y_train = train_df["accepted_label"].astype(int)
    X_test = test_df[categorical_cols + numeric_cols]
    y_test = test_df["accepted_label"].astype(int)

    pipeline.fit(X_train, y_train)
    probs = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "roc_auc": float(roc_auc_score(y_test, probs)),
        "average_precision": float(average_precision_score(y_test, probs)),
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
    }

    model_version = f"logreg-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    bundle = {
        "model": pipeline,
        "model_version": model_version,
        "categorical_cols": categorical_cols,
        "numeric_cols": numeric_cols,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "metrics": metrics,
    }
    return bundle


def main():
    parser = argparse.ArgumentParser(description="Train claim acceptance prediction model.")
    parser.add_argument("--org-id", type=int, default=None, help="Optional organization filter.")
    parser.add_argument(
        "--model-out",
        default="models/claim_acceptance_model.joblib",
        help="Path to save model artifact.",
    )
    parser.add_argument(
        "--metrics-out",
        default="models/claim_acceptance_model_metrics.json",
        help="Path to save model metrics JSON.",
    )
    args = parser.parse_args()

    bundle = train_model(org_id=args.org_id)

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
                "model_version": bundle["model_version"],
                "trained_at": bundle["trained_at"],
                "metrics": bundle["metrics"],
            },
            fp,
            indent=2,
        )

    print(f"Saved model: {args.model_out}")
    print(f"Saved metrics: {args.metrics_out}")
    print(
        f"ROC AUC={bundle['metrics']['roc_auc']:.4f}, "
        f"Average Precision={bundle['metrics']['average_precision']:.4f}"
    )


if __name__ == "__main__":
    main()
