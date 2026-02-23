# Phase 1B Runbook: Preflight to Guarded Uniqueness

This runbook defines the operational sequence for moving from read-only audit checks to guarded natural-key uniqueness enforcement without breaking current pipeline behavior.

## Scope

- Audit script: `20260221_03_pipeline_preflight_audit.sql`
- Guarded uniqueness script: `20260221_04_guarded_natural_key_uniqueness.sql`
- Loader contracts:
  - `scripts/load_to_supabase.py`
  - `scripts/loader_persistence.py`

## Execution Order

1. Run `00001_canonical_schema.sql` and `00002_rpc_functions.sql` if needed.
2. Run additive migrations up to `20260221_03_pipeline_preflight_audit.sql`.
3. Review duplicate/orphan outputs.
4. If cleanup is needed, run targeted cleanup SQL from this runbook.
5. Re-run `20260221_03_pipeline_preflight_audit.sql` until duplicate/orphan checks are clean.
6. Run `20260221_04_guarded_natural_key_uniqueness.sql`.
7. Confirm NOTICE output indicates unique indexes were created (or intentionally skipped).

## Decision Matrix

- `Duplicate natural-key rows found`: cleanup required before strict uniqueness.
- `Orphan rows found`: investigate source first; cleanup with caution.
- `Matching ambiguity rows found`: not always a blocker, but review when unmatched rate is elevated.
- `No duplicate/orphan rows`: proceed to guarded uniqueness migration.

## Cleanup Templates

Always run in a transaction and inspect affected rows before commit.

```sql
BEGIN;
-- your cleanup statement(s)
-- ROLLBACK; -- use while validating
COMMIT;
```

### A) Resolve duplicate `claim_headers` natural-key groups

Keeps the most recent row by `id`, re-points child tables, then deletes older duplicates.

```sql
CREATE TEMP TABLE tmp_claim_header_dups AS
WITH ranked AS (
    SELECT
        id,
        claim_id,
        file_name,
        file_type,
        COALESCE(org_id, -1) AS org_id_key,
        ROW_NUMBER() OVER (
            PARTITION BY claim_id, file_name, file_type, COALESCE(org_id, -1)
            ORDER BY id DESC
        ) AS rn,
        FIRST_VALUE(id) OVER (
            PARTITION BY claim_id, file_name, file_type, COALESCE(org_id, -1)
            ORDER BY id DESC
        ) AS keep_id
    FROM claim_headers
)
SELECT id AS drop_id, keep_id
FROM ranked
WHERE rn > 1;

UPDATE claim_lines cl
SET claim_header_id = d.keep_id
FROM tmp_claim_header_dups d
WHERE cl.claim_header_id = d.drop_id;

UPDATE claim_diagnoses cd
SET claim_header_id = d.keep_id
FROM tmp_claim_header_dups d
WHERE cd.claim_header_id = d.drop_id;

UPDATE claim_dates dt
SET claim_header_id = d.keep_id
FROM tmp_claim_header_dups d
WHERE dt.claim_header_id = d.drop_id;

UPDATE claim_providers p
SET claim_header_id = d.keep_id
FROM tmp_claim_header_dups d
WHERE p.claim_header_id = d.drop_id;

DELETE FROM claim_headers h
USING tmp_claim_header_dups d
WHERE h.id = d.drop_id;

DROP TABLE tmp_claim_header_dups;
```

### B) Resolve duplicate `claim_payments` natural-key groups

Keeps the most recent row by `id`, re-points payment children, then deletes older duplicates.

```sql
CREATE TEMP TABLE tmp_claim_payment_dups AS
WITH ranked AS (
    SELECT
        id,
        file_name,
        patient_control_number,
        COALESCE(check_number, '') AS check_number_key,
        COALESCE(payment_date, DATE '1900-01-01') AS payment_date_key,
        ROW_NUMBER() OVER (
            PARTITION BY
                file_name,
                patient_control_number,
                COALESCE(check_number, ''),
                COALESCE(payment_date, DATE '1900-01-01')
            ORDER BY id DESC
        ) AS rn,
        FIRST_VALUE(id) OVER (
            PARTITION BY
                file_name,
                patient_control_number,
                COALESCE(check_number, ''),
                COALESCE(payment_date, DATE '1900-01-01')
            ORDER BY id DESC
        ) AS keep_id
    FROM claim_payments
)
SELECT id AS drop_id, keep_id
FROM ranked
WHERE rn > 1;

UPDATE claim_payment_lines pl
SET claim_payment_id = d.keep_id
FROM tmp_claim_payment_dups d
WHERE pl.claim_payment_id = d.drop_id;

UPDATE claim_adjustments a
SET claim_payment_id = d.keep_id
FROM tmp_claim_payment_dups d
WHERE a.claim_payment_id = d.drop_id;

DELETE FROM claim_payments p
USING tmp_claim_payment_dups d
WHERE p.id = d.drop_id;

DROP TABLE tmp_claim_payment_dups;
```

### C) Review and remove orphan rows (when present)

Start by counting. Delete only after confirming the parent truly should not exist.

```sql
SELECT COUNT(*) AS orphan_claim_lines
FROM claim_lines l
LEFT JOIN claim_headers h ON h.id = l.claim_header_id
WHERE h.id IS NULL;
```

```sql
SELECT COUNT(*) AS orphan_payment_lines
FROM claim_payment_lines pl
LEFT JOIN claim_payments p ON p.id = pl.claim_payment_id
WHERE p.id IS NULL;
```

Delete template:

```sql
DELETE FROM claim_payment_lines pl
WHERE NOT EXISTS (
  SELECT 1 FROM claim_payments p WHERE p.id = pl.claim_payment_id
);
```

## Post-Cleanup Validation

1. Re-run `20260221_03_pipeline_preflight_audit.sql`.
2. Confirm duplicate/orphan sections return zero rows.
3. Run `20260221_04_guarded_natural_key_uniqueness.sql`.
4. Re-run the audit script one final time.

## Operational Notes

- The synthetic generator (`scripts/generate_test_edi.py`) and loader idempotency model should remain unchanged by this process.
- Do not alter loader natural keys in DB constraints without coordinated updates to:
  - `scripts/load_to_supabase.py`
  - `scripts/loader_persistence.py`
