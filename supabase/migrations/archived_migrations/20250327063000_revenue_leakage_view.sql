/*
  # Create Revenue Leakage View

  1. Changes
    - Create a view for revenue leakage analysis
    - This view aggregates data from healthcare_claims to show revenue gaps
    - Used by the Revenue Leakage Report in the application
    
  2. Security
    - No changes to security model
*/

-- Create the revenue_leakage_view
CREATE OR REPLACE VIEW revenue_leakage_view AS
SELECT
  provider_id,
  payer_id,
  procedure_code,
  COUNT(*) AS claim_count,
  SUM(billed_amount) AS total_billed,
  SUM(paid_amount) AS total_paid,
  SUM(billed_amount - paid_amount) AS revenue_gap,
  CASE 
    WHEN SUM(billed_amount) > 0 
    THEN SUM(paid_amount) / SUM(billed_amount) 
    ELSE 0 
  END AS collection_ratio,
  STRING_AGG(DISTINCT denial_reason, ', ') FILTER (WHERE denial_reason IS NOT NULL) AS denial_reasons
FROM
  healthcare_claims
GROUP BY
  provider_id,
  payer_id,
  procedure_code
HAVING
  COUNT(*) > 0;

-- Add comment to the view
COMMENT ON VIEW revenue_leakage_view IS 'View for analyzing revenue leakage by provider, payer, and procedure';

-- Grant permissions
GRANT SELECT ON revenue_leakage_view TO anon, authenticated, service_role;
