/*
  # Sequence Database Changes

  1. Changes
    - Drop dependent views first
    - Alter table columns to increase VARCHAR sizes
    - Recreate views with updated column references
    
  2. Security
    - Maintains existing RLS policies
    - No changes to security model
*/

-- First drop dependent views
DROP VIEW IF EXISTS revenue_leakage_view;
DROP VIEW IF EXISTS collection_timeline_view;
DROP VIEW IF EXISTS procedure_reimbursement_view;
DROP VIEW IF EXISTS provider_performance_view;
DROP VIEW IF EXISTS claims_aging_view;
DROP VIEW IF EXISTS claims_summary;
DROP VIEW IF EXISTS decrypted_chat_messages;

-- Alter columns to increase VARCHAR size limits
ALTER TABLE healthcare_claims
  ALTER COLUMN procedure_code TYPE VARCHAR(50),
  ALTER COLUMN diagnosis_code TYPE VARCHAR(50),
  ALTER COLUMN revenue_code TYPE VARCHAR(50),
  ALTER COLUMN billing_provider_npi TYPE VARCHAR(50),
  ALTER COLUMN attending_provider_npi TYPE VARCHAR(50),
  ALTER COLUMN adjustment_reason_code TYPE VARCHAR(50),
  ALTER COLUMN claim_filing_indicator_code TYPE VARCHAR(50),
  ALTER COLUMN claim_filing_indicator_desc TYPE VARCHAR(100),
  ALTER COLUMN assignment_code TYPE VARCHAR(50),
  ALTER COLUMN benefits_assignment TYPE VARCHAR(50),
  ALTER COLUMN facility_type_desc TYPE VARCHAR(100),
  ALTER COLUMN facility_code_qualifier_desc TYPE VARCHAR(100),
  ALTER COLUMN claim_frequency_type_desc TYPE VARCHAR(100),
  ALTER COLUMN admission_type_desc TYPE VARCHAR(200),
  ALTER COLUMN admission_source_desc TYPE VARCHAR(200),
  ALTER COLUMN patient_status_desc TYPE VARCHAR(200),
  ALTER COLUMN assignment_desc TYPE VARCHAR(200),
  ALTER COLUMN benefits_assignment_desc TYPE VARCHAR(200);

-- Recreate views
CREATE VIEW claims_summary AS
SELECT 
  c.*,
  p.name as provider_name,
  network_status as network_code
FROM claims c
LEFT JOIN providers p ON c.provider_id = p.id;

CREATE VIEW decrypted_chat_messages AS
SELECT 
  cm.id,
  cm.negotiation_id,
  cm.user_id,
  CASE 
    WHEN cm.encrypted_message IS NOT NULL THEN
      decrypt_message(
        cm.encrypted_message,
        '0123456789abcdef0123456789abcdef',
        cm.encryption_iv
      )
    ELSE
      cm.message
  END as message,
  cm.created_at
FROM chat_messages cm
WHERE EXISTS (
  SELECT 1 FROM negotiations n
  JOIN healthcare_claims c ON c.claim_id = n.claim_id
  WHERE n.id = cm.negotiation_id
);

CREATE VIEW revenue_leakage_view AS
SELECT
  provider_id,
  payer_id,
  procedure_code,
  COUNT(*) as claim_count,
  SUM(billed_amount) as total_billed,
  SUM(paid_amount) as total_paid,
  SUM(billed_amount - COALESCE(paid_amount, 0)) as revenue_gap,
  AVG(CASE 
    WHEN billed_amount > 0 
    THEN COALESCE(paid_amount, 0) / billed_amount 
    ELSE 0 
  END) as collection_ratio,
  STRING_AGG(DISTINCT denial_reason, ', ') as denial_reasons
FROM healthcare_claims
WHERE claim_status = 'denied' 
   OR (billed_amount > COALESCE(paid_amount, 0))
GROUP BY provider_id, payer_id, procedure_code;

CREATE VIEW collection_timeline_view AS
SELECT
  DATE_TRUNC('month', claim_submission_date) as submission_month,
  provider_id,
  payer_id,
  COUNT(*) as total_claims,
  AVG(days_to_hospital_payment) as avg_days_to_payment,
  SUM(CASE 
    WHEN hospital_payment_date IS NULL 
    THEN billed_amount 
    ELSE 0 
  END) as unpaid_amount,
  COUNT(CASE 
    WHEN hospital_payment_date IS NULL 
    THEN 1 
  END) as unpaid_claims
FROM healthcare_claims
GROUP BY DATE_TRUNC('month', claim_submission_date), provider_id, payer_id;

CREATE VIEW procedure_reimbursement_view AS
SELECT
  procedure_code,
  provider_id,
  payer_id,
  COUNT(*) as procedure_count,
  AVG(billed_amount) as avg_billed,
  AVG(paid_amount) as avg_paid,
  AVG(CASE 
    WHEN billed_amount > 0 
    THEN paid_amount / billed_amount 
    ELSE 0 
  END) as reimbursement_rate,
  STDDEV(CASE 
    WHEN billed_amount > 0 
    THEN paid_amount / billed_amount 
    ELSE 0 
  END) as rate_variance
FROM healthcare_claims
WHERE procedure_code IS NOT NULL
GROUP BY procedure_code, provider_id, payer_id;

CREATE VIEW provider_performance_view AS
SELECT
  provider_id,
  COUNT(*) as total_claims,
  SUM(billed_amount) as total_billed,
  SUM(paid_amount) as total_collected,
  AVG(days_to_hospital_payment) as avg_collection_days,
  COUNT(CASE 
    WHEN claim_status = 'denied' 
    THEN 1 
  END)::float / COUNT(*) as denial_rate,
  AVG(CASE 
    WHEN billed_amount > 0 
    THEN paid_amount / billed_amount 
    ELSE 0 
  END) as collection_ratio
FROM healthcare_claims
GROUP BY provider_id;

CREATE VIEW claims_aging_view AS
SELECT
  provider_id,
  payer_id,
  SUM(CASE 
    WHEN claim_age_days <= 30 THEN billed_amount 
    ELSE 0 
  END) as amount_0_30,
  SUM(CASE 
    WHEN claim_age_days > 30 AND claim_age_days <= 60 THEN billed_amount 
    ELSE 0 
  END) as amount_31_60,
  SUM(CASE 
    WHEN claim_age_days > 60 AND claim_age_days <= 90 THEN billed_amount 
    ELSE 0 
  END) as amount_61_90,
  SUM(CASE 
    WHEN claim_age_days > 90 THEN billed_amount 
    ELSE 0 
  END) as amount_90_plus,
  COUNT(CASE 
    WHEN claim_age_days <= 30 THEN 1 
  END) as count_0_30,
  COUNT(CASE 
    WHEN claim_age_days > 30 AND claim_age_days <= 60 THEN 1 
  END) as count_31_60,
  COUNT(CASE 
    WHEN claim_age_days > 60 AND claim_age_days <= 90 THEN 1 
  END) as count_61_90,
  COUNT(CASE 
    WHEN claim_age_days > 90 THEN 1 
  END) as count_90_plus
FROM healthcare_claims
WHERE hospital_payment_date IS NULL
GROUP BY provider_id, payer_id;

-- Add comments
COMMENT ON TABLE healthcare_claims IS 'Stores healthcare claims data with extended field lengths for codes and descriptions';
COMMENT ON VIEW revenue_leakage_view IS 'Analyzes claims with potential revenue loss';
COMMENT ON VIEW collection_timeline_view IS 'Tracks payment velocity and aging claims';
COMMENT ON VIEW procedure_reimbursement_view IS 'Analyzes reimbursement rates by procedure';
COMMENT ON VIEW provider_performance_view IS 'Measures provider billing effectiveness';
COMMENT ON VIEW claims_aging_view IS 'Breaks down unpaid claims by age buckets';