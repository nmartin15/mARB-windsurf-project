/*
  # Add Billing Code to Healthcare Claims Table

  1. Changes
    - Adds billing_code column to healthcare_claims table
    - Updates existing records with sample billing codes
    - Creates an index for improved query performance
    
  2. Security
    - Maintains existing permissions
*/

-- Add the billing_code column to the healthcare_claims table
ALTER TABLE healthcare_claims 
ADD COLUMN IF NOT EXISTS billing_code VARCHAR(20);

-- Create an index for the new column
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_billing_code 
ON healthcare_claims(billing_code);

-- Update existing records with sample billing codes
-- Using a pattern based on the claim_id to ensure consistency
UPDATE healthcare_claims
SET billing_code = 
  CASE 
    WHEN claim_filing_indicator = 'MC' THEN 'MC-' || SUBSTRING(claim_id, 9)
    WHEN claim_filing_indicator = 'BL' THEN 'BL-' || SUBSTRING(claim_id, 9)
    WHEN claim_filing_indicator = 'CI' THEN 'CI-' || SUBSTRING(claim_id, 9)
    WHEN claim_filing_indicator = 'MB' THEN 'MB-' || SUBSTRING(claim_id, 9)
    ELSE 'BC-' || SUBSTRING(claim_id, 9)
  END;

-- Add comment to the column
COMMENT ON COLUMN healthcare_claims.billing_code IS 'Unique billing code for the claim, used for identification in list views';

-- Update the Dashboard component to display billing codes
-- This is a reminder for frontend changes needed