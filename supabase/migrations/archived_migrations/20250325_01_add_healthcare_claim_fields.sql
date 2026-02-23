/*
  # Add Additional Healthcare Claims Columns

  1. Changes
    - Add date tracking columns for payment and submission
    - Add calculated days columns for processing metrics
    - Add patient, provider, and payer identifiers
    - Add clinical and coding information
    - Add financial columns for claim amounts
    - Add performance indexes
    
  2. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Add payment and submission date columns
ALTER TABLE healthcare_claims
ADD COLUMN IF NOT EXISTS hospital_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS claim_submission_date TIMESTAMPTZ;

-- Add calculated days columns
ALTER TABLE healthcare_claims
ADD COLUMN IF NOT EXISTS days_to_hospital_payment INTEGER,
ADD COLUMN IF NOT EXISTS days_to_claim_submission INTEGER,
ADD COLUMN IF NOT EXISTS total_processing_days INTEGER,
ADD COLUMN IF NOT EXISTS service_duration_days INTEGER,
ADD COLUMN IF NOT EXISTS claim_age_days INTEGER;

-- Add patient, provider, and payer identifiers
ALTER TABLE healthcare_claims
ADD COLUMN IF NOT EXISTS patient_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS payer_id VARCHAR(20);

-- Add clinical and coding information
ALTER TABLE healthcare_claims
ADD COLUMN IF NOT EXISTS diagnosis_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS procedure_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS revenue_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS place_of_service VARCHAR(10),
ADD COLUMN IF NOT EXISTS billing_provider_npi VARCHAR(20),
ADD COLUMN IF NOT EXISTS attending_provider_npi VARCHAR(20);

-- Add financial columns
ALTER TABLE healthcare_claims
ADD COLUMN IF NOT EXISTS claim_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS denial_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS adjustment_reason_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS allowed_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS patient_responsibility DECIMAL(12,2);

-- Add indexes for better query performance
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_healthcare_claims_payment_date') THEN
    CREATE INDEX idx_healthcare_claims_payment_date ON healthcare_claims(hospital_payment_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_healthcare_claims_submission_date') THEN
    CREATE INDEX idx_healthcare_claims_submission_date ON healthcare_claims(claim_submission_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_healthcare_claims_patient_id') THEN
    CREATE INDEX idx_healthcare_claims_patient_id ON healthcare_claims(patient_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_healthcare_claims_provider_id') THEN
    CREATE INDEX idx_healthcare_claims_provider_id ON healthcare_claims(provider_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_healthcare_claims_claim_status') THEN
    CREATE INDEX idx_healthcare_claims_claim_status ON healthcare_claims(claim_status);
  END IF;
END $$;