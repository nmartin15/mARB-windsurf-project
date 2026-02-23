-- =============================================================================
-- Guarded Natural-Key Uniqueness (Phase 1B)
-- =============================================================================
-- Purpose:
--   Enforce idempotent loader natural keys when data is clean, while avoiding
--   hard migration failures on environments with historical duplicate rows.
--
-- Safety model:
--   - If duplicate rows are detected, constraint creation is skipped.
--   - Emits NOTICE messages so operators can clean data, then re-run.
-- =============================================================================

DO $$
DECLARE
    dup_claim_headers BIGINT;
    dup_claim_payments BIGINT;
BEGIN
    -- 837 header natural key used by loader:
    -- claim_id + file_name + file_type + org_id (org_id can be NULL)
    SELECT COUNT(*) INTO dup_claim_headers
    FROM (
        SELECT
            claim_id,
            file_name,
            file_type,
            COALESCE(org_id, -1) AS org_id_key,
            COUNT(*) AS c
        FROM claim_headers
        GROUP BY claim_id, file_name, file_type, COALESCE(org_id, -1)
        HAVING COUNT(*) > 1
    ) d;

    IF dup_claim_headers = 0 THEN
        EXECUTE '
            CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_headers_natural_key
            ON claim_headers (claim_id, file_name, file_type, COALESCE(org_id, -1))
        ';
        RAISE NOTICE 'Created uq_claim_headers_natural_key (no duplicates found).';
    ELSE
        RAISE NOTICE 'Skipped uq_claim_headers_natural_key: % duplicate natural-key groups found.', dup_claim_headers;
    END IF;

    -- 835 payment natural key used by loader:
    -- file_name + patient_control_number + check_number + payment_date
    -- check_number and payment_date can be NULL in loader logic, so normalize.
    SELECT COUNT(*) INTO dup_claim_payments
    FROM (
        SELECT
            file_name,
            patient_control_number,
            COALESCE(check_number, '') AS check_number_key,
            COALESCE(payment_date, DATE '1900-01-01') AS payment_date_key,
            COUNT(*) AS c
        FROM claim_payments
        GROUP BY
            file_name,
            patient_control_number,
            COALESCE(check_number, ''),
            COALESCE(payment_date, DATE '1900-01-01')
        HAVING COUNT(*) > 1
    ) d;

    IF dup_claim_payments = 0 THEN
        EXECUTE '
            CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_payments_natural_key
            ON claim_payments (
                file_name,
                patient_control_number,
                COALESCE(check_number, ''''),
                COALESCE(payment_date, DATE ''1900-01-01'')
            )
        ';
        RAISE NOTICE 'Created uq_claim_payments_natural_key (no duplicates found).';
    ELSE
        RAISE NOTICE 'Skipped uq_claim_payments_natural_key: % duplicate natural-key groups found.', dup_claim_payments;
    END IF;
END $$;
