# ML Claim Acceptance Prediction — Architecture

## Overview

mARB Health will include an ML model that predicts the probability of a claim being accepted on first submission. This helps practices identify and fix issues before submission, improving clean claim rates and reducing denial-related revenue loss.

## Database Foundation (already in canonical schema)

### claim_headers columns
- `prediction_score DECIMAL(5,4)` — probability (0.0000 to 1.0000) that the claim will be accepted
- `prediction_factors JSONB` — structured explanation of why the score is what it is

### prediction_history table
- `claim_header_id` — FK to claim_headers
- `prediction_score` — the predicted probability
- `prediction_factors` — JSONB with feature importance breakdown
- `model_version` — which model version produced this prediction
- `predicted_at` — timestamp

## Feature Set

The model will be trained on historical claim accept/deny patterns. Key features:

### Claim-Level Features
| Feature | Source | Type |
|---------|--------|------|
| `payer_id` | claim_headers | categorical |
| `claim_filing_indicator_code` | claim_headers | categorical |
| `total_charge_amount` | claim_headers | numeric |
| `claim_type` | claim_headers | categorical (professional/institutional) |
| `facility_type_code` | claim_headers | categorical |
| `has_prior_auth` | claim_headers.prior_auth_number IS NOT NULL | boolean |

### Line-Level Aggregated Features
| Feature | Source | Type |
|---------|--------|------|
| `num_service_lines` | COUNT(claim_lines) | numeric |
| `primary_procedure_code` | claim_lines.procedure_code (line 1) | categorical |
| `total_line_charges` | SUM(claim_lines.charge_amount) | numeric |
| `charge_matches_total` | SUM(lines) = header.total_charge_amount | boolean |

### Diagnosis Features
| Feature | Source | Type |
|---------|--------|------|
| `primary_diagnosis_code` | claim_diagnoses WHERE type='principal' | categorical |
| `num_diagnoses` | COUNT(claim_diagnoses) | numeric |
| `has_admitting_dx` | EXISTS admitting diagnosis | boolean |

### Provider Features
| Feature | Source | Type |
|---------|--------|------|
| `billing_provider_npi` | claim_providers WHERE role='billing' | categorical |
| `rendering_provider_npi` | claim_providers WHERE role='rendering' | categorical |
| `has_referring_provider` | EXISTS referring provider | boolean |
| `billing_taxonomy` | claim_providers.taxonomy_code | categorical |

### Historical Features (most predictive)
| Feature | Source | Type |
|---------|--------|------|
| `payer_historical_denial_rate` | past claim_adjustments for this payer | numeric |
| `procedure_historical_denial_rate` | past denials for this CPT code | numeric |
| `payer_procedure_denial_rate` | combination of payer + procedure | numeric |
| `provider_historical_denial_rate` | past denials for this provider | numeric |
| `avg_days_to_payment_payer` | mean payment speed for this payer | numeric |
| `payer_denial_count_last_90d` | recent denial volume | numeric |

### Completeness Features
| Feature | Source | Type |
|---------|--------|------|
| `has_service_date` | claim_dates WHERE qualifier='472' | boolean |
| `has_statement_dates` | claim_dates WHERE qualifier IN ('232','233') | boolean |
| `all_lines_have_codes` | all lines have procedure_code | boolean |
| `missing_field_count` | count of null required fields | numeric |

## Pipeline Architecture

```
1. Feature Extraction (Python)
   ├── Query claim_headers + related tables
   ├── Compute historical aggregates
   └── Build feature matrix (pandas DataFrame)

2. Model Training (scikit-learn or XGBoost)
   ├── Binary classification: accepted vs denied/rejected
   ├── Train/test split by date (no data leakage)
   ├── Cross-validation for hyperparameter tuning
   └── Save model artifact with version tag

3. Inference (on new claims)
   ├── Triggered when new 837 is loaded
   ├── Extract features for the new claim
   ├── Run model.predict_proba()
   ├── Store score + factors in claim_headers
   └── Log to prediction_history

4. Dashboard Integration
   ├── Show prediction score on claim detail panel
   ├── Color-code: green (>0.9), yellow (0.7-0.9), red (<0.7)
   ├── Show top contributing factors
   └── Filter claims by prediction risk level
```

## Model Selection

Start with **XGBoost** (gradient boosted trees) because:
- Handles mixed feature types (numeric + categorical) natively
- Provides feature importance for explainability
- Works well with tabular data and moderate dataset sizes
- Fast inference for real-time predictions

## Data Requirements

Minimum training data:
- 1,000+ claims with known outcomes (accepted/denied)
- At least 3 months of historical data
- 835 remittance data linked to 837 claims

## Future Enhancements

1. **Real-time pre-submission scoring** — score claims before they go to clearinghouse
2. **Denial reason prediction** — predict which CARC code will be used
3. **Recommended corrections** — suggest specific fixes to improve acceptance probability
4. **Model retraining pipeline** — automated periodic retraining as new data arrives
5. **A/B testing** — measure impact of prediction-guided corrections on clean claim rate
