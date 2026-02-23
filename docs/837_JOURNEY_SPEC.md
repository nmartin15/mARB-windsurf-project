# 837 Journey Spec (Source of Truth)

Purpose: define one clean, auditable path for an 837 claim file from ingestion to frontend display.  
If this path is unclear, implementation complexity will leak into product behavior.

## North Star

`837 file in -> parsed to canonical shape -> loaded to canonical tables -> reconciled with 835 outcomes -> scored -> visible in UI`

## End-to-End Flow

1. **Generate/receive 837**
   - Source: clearinghouse (prod) or synthetic generator (test/demo).
   - Test generator: `scripts/generate_test_edi.py`

2. **Parse 837 (contract-first)**
   - Parser: `scripts/parse_837p.py`
   - Output envelope includes:
     - file metadata (`file_name`, `file_type`, `file_hash`, `record_count`)
     - `claims[]` with canonical claim-level objects
     - `parse_summary` quality signals

3. **Load parsed 837 to DB**
   - Loader: `scripts/load_to_supabase.py --type 837P`
   - Dedup gate: `edi_file_log.file_hash`
   - Upsert/replace behavior preserves idempotent reloads for claim children

4. **Canonical tables populated (837 side)**
   - `claim_headers`
   - `claim_lines`
   - `claim_diagnoses`
   - `claim_dates`
   - `claim_providers`
   - `claim_references`
   - `edi_file_log`

5. **Parse/load 835 remits**
   - Parser: `scripts/parse_835.py`
   - Loader: `scripts/load_to_supabase.py --type 835`
   - Matching logic: `scripts/claim_matching.py`

6. **Canonical tables populated (835 side)**
   - `claim_payments`
   - `claim_payment_lines`
   - `claim_adjustments`
   - `claim_headers` status/payment fields updated from matched remits

7. **Prediction scoring**
   - Scorer: `scripts/score_claims.py`
   - Writes:
     - `claim_headers.prediction_score`
     - `claim_headers.prediction_factors`
     - `prediction_history`

8. **Frontend consumption**
   - Claims list: `src/pages/ClaimsList.tsx`
   - Claim details: `src/components/claims/ClaimDetailPanel.tsx`
   - Dashboard: `src/pages/Dashboard.tsx`
   - Data source is canonical tables + RPCs on canonical schema

## Canonical Contracts

### Parser Contract (must be stable)

- The parser must never crash the whole file for unknown optional qualifiers/codes.
- Required canonical identity fields must be present for each claim/payment record.
- Unknown values are preserved with warnings in `parse_summary` (not dropped silently).

Primary contract document:
- `docs/EDI_PARSING_CONTRACT.md`

### Loader Contract (must be deterministic)

- Loader accepts parser output envelope directly.
- Loader writes canonical rows only (no side schema).
- Duplicate files are skipped by file hash.
- Matching failures do not drop 835 rows; unmatched payments still persist.

### Frontend Contract (must be canonical-only)

- UI reads from canonical tables and canonical RPCs.
- No dependency on deprecated table families.
- Prediction UI must degrade gracefully when score/factors are missing.

## Table Responsibility Matrix

- `claim_headers`: one row per claim; claim status + financial summary + prediction fields
- `claim_lines`: service line details (`LX/SV1`)
- `claim_diagnoses`: diagnosis composites (`HI`)
- `claim_dates`: claim and line dates (`DTP`)
- `claim_providers`: claim participants (`NM1/PRV`)
- `claim_references`: claim references (`REF`, incl. prior auth)
- `claim_payments`: CLP-level adjudication
- `claim_payment_lines`: SVC-level adjudication
- `claim_adjustments`: CAS adjustments/denials
- `prediction_history`: model score history by claim + model version
- `edi_file_log`: ingestion audit and dedup

## One-Command Demo Journey

Use the journey runner for a reproducible path:

`python scripts/run_837_demo_journey.py --claims 250 --days 10`

Strict mode (must include DB load):

`python scripts/run_837_demo_journey.py --claims 250 --days 10 --apply-migrations --load-db --require-db-load`

Outputs:
- parsed payloads
- validation report
- model artifact + metrics
- consolidated `journey_report.json`

## Quality Gates (Definition of Done)

The journey is considered healthy only when all pass:

- Parse file fail rate under configured threshold
- Invalid date rate under configured threshold
- Direct 835-to-837 matching is coherent for expected test corpus
- In strict mode, DB load executes successfully
- Scoring writes prediction fields for loaded claims
- Frontend can render claims and prediction panel without runtime errors

## Failure Modes and Immediate Action

- **Missing canonical tables (`claim_headers` not found):**
  - Apply canonical migrations (`00001`, `00002`) before load tests.
- **Parser warnings spike:**
  - Review new payer variants and promote qualifiers via config/mapping.
- **Unmatched 835 rises:**
  - Inspect matching reason codes and `CLP01/CLP07` coverage.
- **Prediction writes absent:**
  - Verify model artifact path and scorer execution.

## Non-Negotiables

- One canonical schema.
- One parser->loader contract.
- One reproducible journey command.
- One report artifact per run.
- No silent fallbacks that hide data loss.

