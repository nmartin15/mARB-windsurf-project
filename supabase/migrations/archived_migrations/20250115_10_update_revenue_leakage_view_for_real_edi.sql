/*
  # Update Revenue Leakage View for Real EDI Data
  
  1. Changes
    - Update revenue_leakage_view to work with real EDI data structure
    - Query individual claims (not aggregated)
    - Use VARCHAR IDs (not UUID)
    - Handle real EDI field names and structure
    
  2. Security
    - Maintains existing permissions
*/

-- Drop existing view
DROP VIEW IF EXISTS revenue_leakage_view;

-- Create updated view for real EDI data
-- This view shows individual claims with revenue gaps (for use in RevenueLeak component)
CREATE OR REPLACE VIEW revenue_leakage_view AS
SELECT
  hc.claim_id,
  hc.provider_id,
  hc.provider_name,
  hc.payer_id,
  hc.payer_name,
  hc.procedure_code,
  hc.billed_amount AS total_billed,
  COALESCE(hc.paid_amount, 0) AS total_paid,
  (hc.billed_amount - COALESCE(hc.paid_amount, 0)) AS revenue_gap,
  CASE 
    WHEN hc.billed_amount > 0 
    THEN COALESCE(hc.paid_amount, 0) / hc.billed_amount 
    ELSE 0 
  END AS collection_ratio,
  hc.denial_reason,
  hc.claim_status,
  hc.file_name,
  hc.service_date_start,
  hc.created_at
FROM healthcare_claims hc
WHERE hc.file_name IS NOT NULL  -- Only real EDI data
  AND (
    hc.billed_amount > COALESCE(hc.paid_amount, 0)  -- Revenue gap
    OR hc.claim_status IN ('Denied', 'denied')      -- Denied claims
    OR hc.paid_amount IS NULL                       -- Unpaid claims
  );

-- Grant permissions
GRANT SELECT ON revenue_leakage_view TO authenticated, anon;

-- Add comment
COMMENT ON VIEW revenue_leakage_view IS 'Individual claims with revenue leakage from real EDI data - used by RevenueLeak component';

