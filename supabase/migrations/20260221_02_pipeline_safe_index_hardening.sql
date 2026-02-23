-- Pipeline-safe index hardening for existing 837/835 ingest and dashboard reads.
-- Additive only: no renames, drops, or contract-breaking changes.

-- 1) Support 837 claim upsert natural key lookup in scripts/load_to_supabase.py
CREATE INDEX IF NOT EXISTS idx_claim_headers_upsert_natural_key
    ON claim_headers(claim_id, file_name, file_type, org_id);

-- 2) Support 835 payment upsert natural key lookup in scripts/load_to_supabase.py
CREATE INDEX IF NOT EXISTS idx_claim_payments_upsert_natural_key
    ON claim_payments(file_name, patient_control_number, check_number, payment_date);

-- 3) Improve fallback matching by original claim id in scripts/claim_matching.py
CREATE INDEX IF NOT EXISTS idx_claim_headers_original_claim_id
    ON claim_headers(original_claim_id)
    WHERE original_claim_id IS NOT NULL;

-- 4) Improve CLP07 REF qualifier + value matching in scripts/claim_matching.py
CREATE INDEX IF NOT EXISTS idx_claim_references_qualifier_value
    ON claim_references(reference_qualifier, reference_value)
    WHERE reference_value IS NOT NULL;

-- 5) Improve broad CLP07 REF value fallback matching in scripts/claim_matching.py
CREATE INDEX IF NOT EXISTS idx_claim_references_value
    ON claim_references(reference_value)
    WHERE reference_value IS NOT NULL;

-- 6) Improve payment velocity/trend date lookup from header-level claim dates
CREATE INDEX IF NOT EXISTS idx_claim_dates_header_qualifier_parsed
    ON claim_dates(claim_header_id, date_qualifier, parsed_date)
    WHERE claim_line_id IS NULL AND parsed_date IS NOT NULL;

-- 7) Improve joins from payment service lines to originating claim lines
CREATE INDEX IF NOT EXISTS idx_claim_payment_lines_claim_line
    ON claim_payment_lines(claim_line_id)
    WHERE claim_line_id IS NOT NULL;
