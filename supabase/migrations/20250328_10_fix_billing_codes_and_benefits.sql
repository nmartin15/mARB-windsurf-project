/*
  # Fix Billing Codes and Benefits Assignment Data

  1. Changes
    - Updates billing codes to be consistent with insurance carriers
    - Makes benefits assignment data more realistic (80% assigned, 20% other)
    
  2. Security
    - Maintains existing permissions
*/

-- First, update billing codes to be consistent with insurance carriers
UPDATE healthcare_claims
SET billing_code = 
  CASE 
    WHEN claim_filing_indicator_code = 'MC' THEN 'MC-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'MB' THEN 'MB-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'BL' THEN 'BL-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'CI' THEN 'CI-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'CH' THEN 'CH-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'OF' THEN 'OF-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'TV' THEN 'TV-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'VA' THEN 'VA-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'WC' THEN 'WC-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'DM' THEN 'DM-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'HM' THEN 'HM-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'LM' THEN 'LM-' || SUBSTRING(billing_code, 4)
    WHEN claim_filing_indicator_code = 'AM' THEN 'AM-' || SUBSTRING(billing_code, 4)
    ELSE billing_code
  END
WHERE billing_code LIKE 'BC-%';

-- Now, make benefits assignment data more realistic
-- First, set all to 'N' (No) to reset
UPDATE healthcare_claims
SET 
  benefits_assignment = 'N',
  benefits_assignment_desc = 'No-Benefits have not been assigned';

-- Then update approximately 80% to 'Y' (Yes)
UPDATE healthcare_claims
SET 
  benefits_assignment = 'Y',
  benefits_assignment_desc = 'Yes-Benefits have been assigned'
WHERE id IN (
  SELECT id 
  FROM healthcare_claims 
  ORDER BY RANDOM() 
  LIMIT (SELECT FLOOR(COUNT(*) * 0.8) FROM healthcare_claims)
);
