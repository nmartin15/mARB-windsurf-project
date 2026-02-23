-- Add optional 835-to-837 matching/audit fields to claim_payments.
-- Safe to run multiple times.

ALTER TABLE claim_payments
    ADD COLUMN IF NOT EXISTS payer_claim_control_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS match_strategy VARCHAR(40),
    ADD COLUMN IF NOT EXISTS match_reason_code VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_claim_payments_payer_claim_control
    ON claim_payments(payer_claim_control_number);

CREATE INDEX IF NOT EXISTS idx_claim_payments_match_strategy
    ON claim_payments(match_strategy);
