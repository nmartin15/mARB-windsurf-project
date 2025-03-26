/*
  # Add Healthcare Claims Reports Schema

  1. New Views
    - revenue_leakage_view
    - collection_timeline_view
    - procedure_reimbursement_view
    - provider_performance_view
    - claims_aging_view

  2. Changes
    - Add computed columns for financial analysis
    - Add indexes for report performance
    - Create aggregated views for reporting
*/

-- Create view for revenue leakage analysis
CREATE OR REPLACE VIEW revenue_leakage_view AS
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

-- Create view for collection timeline analysis
CREATE OR REPLACE VIEW collection_timeline_view AS
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

-- Create view for procedure reimbursement analysis
CREATE OR REPLACE VIEW procedure_reimbursement_view AS
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

-- Create view for provider performance analysis
CREATE OR REPLACE VIEW provider_performance_view AS
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

-- Create view for claims aging analysis
CREATE OR REPLACE VIEW claims_aging_view AS
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

-- Add indexes for report performance
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_procedure_code 
ON healthcare_claims(procedure_code);

CREATE INDEX IF NOT EXISTS idx_healthcare_claims_payer_id 
ON healthcare_claims(payer_id);

CREATE INDEX IF NOT EXISTS idx_healthcare_claims_dates 
ON healthcare_claims(claim_submission_date, hospital_payment_date);

-- Add comment
COMMENT ON VIEW revenue_leakage_view IS 'Analyzes claims with potential revenue loss';
COMMENT ON VIEW collection_timeline_view IS 'Tracks payment velocity and aging claims';
COMMENT ON VIEW procedure_reimbursement_view IS 'Analyzes reimbursement rates by procedure';
COMMENT ON VIEW provider_performance_view IS 'Measures provider billing effectiveness';
COMMENT ON VIEW claims_aging_view IS 'Breaks down unpaid claims by age buckets';