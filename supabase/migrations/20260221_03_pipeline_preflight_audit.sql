-- =============================================================================
-- Pipeline Preflight Audit (Read-Only)
-- =============================================================================
-- Purpose:
--   Validate data integrity and pipeline assumptions before adding stricter
--   constraints (for example, future UNIQUE constraints on natural keys).
--
-- Safety:
--   This script is read-only (SELECT statements only). It does not mutate data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) High-level volume snapshot
-- -----------------------------------------------------------------------------
SELECT 'claim_headers' AS table_name, COUNT(*) AS row_count FROM claim_headers
UNION ALL
SELECT 'claim_lines', COUNT(*) FROM claim_lines
UNION ALL
SELECT 'claim_diagnoses', COUNT(*) FROM claim_diagnoses
UNION ALL
SELECT 'claim_dates', COUNT(*) FROM claim_dates
UNION ALL
SELECT 'claim_providers', COUNT(*) FROM claim_providers
UNION ALL
SELECT 'claim_references', COUNT(*) FROM claim_references
UNION ALL
SELECT 'claim_payments', COUNT(*) FROM claim_payments
UNION ALL
SELECT 'claim_payment_lines', COUNT(*) FROM claim_payment_lines
UNION ALL
SELECT 'claim_adjustments', COUNT(*) FROM claim_adjustments
UNION ALL
SELECT 'edi_file_log', COUNT(*) FROM edi_file_log
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- 1) Duplicate detection for 837 upsert natural key
-- Expected: 0 rows
-- -----------------------------------------------------------------------------
SELECT
    claim_id,
    file_name,
    file_type,
    org_id,
    COUNT(*) AS dup_count
FROM claim_headers
GROUP BY claim_id, file_name, file_type, org_id
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, claim_id;

-- -----------------------------------------------------------------------------
-- 2) Duplicate detection for 835 upsert natural key
-- Expected: 0 rows
-- -----------------------------------------------------------------------------
SELECT
    file_name,
    patient_control_number,
    check_number,
    payment_date,
    COUNT(*) AS dup_count
FROM claim_payments
GROUP BY file_name, patient_control_number, check_number, payment_date
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, file_name;

-- -----------------------------------------------------------------------------
-- 3) Matching-ambiguity checks
-- These are not always hard errors, but should be reviewed before strict rules.
-- -----------------------------------------------------------------------------

-- 3a) claim_id reused across multiple claim headers (cross-file or org collisions)
SELECT
    claim_id,
    COUNT(*) AS occurrences
FROM claim_headers
GROUP BY claim_id
HAVING COUNT(*) > 1
ORDER BY occurrences DESC, claim_id;

-- 3b) original_claim_id collisions (can cause ambiguous CLP07 fallback matching)
SELECT
    original_claim_id,
    COUNT(*) AS occurrences
FROM claim_headers
WHERE original_claim_id IS NOT NULL
GROUP BY original_claim_id
HAVING COUNT(*) > 1
ORDER BY occurrences DESC, original_claim_id;

-- 3c) REF qualifier/value collisions (can cause ambiguous REF-based matching)
SELECT
    reference_qualifier,
    reference_value,
    COUNT(*) AS occurrences
FROM claim_references
WHERE reference_value IS NOT NULL
GROUP BY reference_qualifier, reference_value
HAVING COUNT(*) > 1
ORDER BY occurrences DESC, reference_qualifier, reference_value;

-- -----------------------------------------------------------------------------
-- 4) Orphan checks (defensive validation)
-- Expected: 0 rows for each query
-- -----------------------------------------------------------------------------

SELECT l.id AS claim_line_id
FROM claim_lines l
LEFT JOIN claim_headers h ON h.id = l.claim_header_id
WHERE h.id IS NULL
LIMIT 100;

SELECT d.id AS claim_diagnosis_id
FROM claim_diagnoses d
LEFT JOIN claim_headers h ON h.id = d.claim_header_id
WHERE h.id IS NULL
LIMIT 100;

SELECT dt.id AS claim_date_id
FROM claim_dates dt
LEFT JOIN claim_headers h ON h.id = dt.claim_header_id
WHERE h.id IS NULL
LIMIT 100;

SELECT p.id AS claim_provider_id
FROM claim_providers p
LEFT JOIN claim_headers h ON h.id = p.claim_header_id
WHERE h.id IS NULL
LIMIT 100;

SELECT r.id AS claim_reference_id
FROM claim_references r
LEFT JOIN claim_headers h ON h.id = r.claim_header_id
WHERE h.id IS NULL
LIMIT 100;

SELECT pl.id AS claim_payment_line_id
FROM claim_payment_lines pl
LEFT JOIN claim_payments cp ON cp.id = pl.claim_payment_id
WHERE cp.id IS NULL
LIMIT 100;

SELECT a.id AS claim_adjustment_id
FROM claim_adjustments a
LEFT JOIN claim_payments cp ON cp.id = a.claim_payment_id
WHERE cp.id IS NULL
LIMIT 100;

-- -----------------------------------------------------------------------------
-- 5) Pipeline quality checks
-- -----------------------------------------------------------------------------

-- 5a) Header-level service dates missing parsed_date for common qualifiers
SELECT
    date_qualifier,
    COUNT(*) AS missing_parsed_date_count
FROM claim_dates
WHERE claim_line_id IS NULL
  AND date_qualifier IN ('472', '232')
  AND parsed_date IS NULL
GROUP BY date_qualifier
ORDER BY missing_parsed_date_count DESC;

-- 5b) 835 payments with no matched claim header
SELECT
    COUNT(*) AS unmatched_payments,
    ROUND(
        100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM claim_payments), 0),
        2
    ) AS unmatched_percent
FROM claim_payments
WHERE claim_header_id IS NULL;

-- 5c) File log duplicate hash anomalies (should be prevented by UNIQUE(file_hash))
SELECT
    file_hash,
    COUNT(*) AS dup_count
FROM edi_file_log
WHERE file_hash IS NOT NULL AND file_hash <> ''
GROUP BY file_hash
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, file_hash;
