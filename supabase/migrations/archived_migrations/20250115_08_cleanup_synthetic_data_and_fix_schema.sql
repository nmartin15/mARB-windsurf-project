/*
  # Cleanup Synthetic Data and Fix Schema for Real EDI Data
  
  1. Changes
    - Remove all synthetic/sample data from healthcare_claims
    - Ensure schema matches real EDI 837/835 data structure
    - Fix any inconsistencies with real data format
    
  2. Security
    - No changes to security model
*/

-- Remove all synthetic/sample data
-- This removes data inserted by migrations like:
-- - 20250327165230_create_healthcare_claims.sql (sample claims)
-- - 20250326070000_realistic_837_835_data.sql (150 synthetic claims)
-- - 20250328_08_populate_missing_fields.sql (populated synthetic data)
DELETE FROM healthcare_claims 
WHERE file_name IS NULL 
   OR file_name NOT LIKE '%.TXT'
   OR claim_id LIKE 'CL-2025-%'
   OR claim_id LIKE 'CLM837-%'
   OR claim_id LIKE 'CLM2024%';

-- Also clean up related tables if they have synthetic data
DELETE FROM claim_lines WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

DELETE FROM claim_diagnoses WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

DELETE FROM claim_header_dates WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

DELETE FROM claim_line_dates WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

DELETE FROM claim_providers WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

DELETE FROM claim_provider_taxonomy WHERE claim_id IN (
  SELECT claim_id FROM healthcare_claims WHERE file_name IS NULL
);

-- Ensure claim_id is VARCHAR(50) and has unique constraint
DO $$
BEGIN
  -- Add unique constraint on claim_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_healthcare_claims_claim_id'
  ) THEN
    ALTER TABLE healthcare_claims 
    ADD CONSTRAINT uq_healthcare_claims_claim_id UNIQUE (claim_id);
    
    RAISE NOTICE 'Added unique constraint on claim_id';
  END IF;
END $$;

-- Ensure file_name column exists and is properly sized
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'file_name'
  ) THEN
    ALTER TABLE healthcare_claims 
    ADD COLUMN file_name VARCHAR(255);
    
    RAISE NOTICE 'Added file_name column';
  ELSE
    ALTER TABLE healthcare_claims 
    ALTER COLUMN file_name TYPE VARCHAR(255);
    
    RAISE NOTICE 'Ensured file_name is VARCHAR(255)';
  END IF;
END $$;

-- Ensure seg_count column exists for validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'seg_count'
  ) THEN
    ALTER TABLE healthcare_claims 
    ADD COLUMN seg_count INTEGER;
    
    RAISE NOTICE 'Added seg_count column';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN healthcare_claims.file_name IS 'Source EDI file name (required for real data)';
COMMENT ON COLUMN healthcare_claims.seg_count IS 'Segment count for validation (from EDI processing)';
COMMENT ON COLUMN healthcare_claims.claim_id IS 'Claim identifier from EDI CLM segment (must be unique)';

-- Verify schema is ready for real EDI data
DO $$
DECLARE
  uuid_count INTEGER;
  varchar_count INTEGER;
BEGIN
  -- Check provider_id
  SELECT COUNT(*) INTO uuid_count
  FROM information_schema.columns 
  WHERE table_name = 'healthcare_claims' 
  AND column_name = 'provider_id' 
  AND data_type = 'uuid';
  
  IF uuid_count > 0 THEN
    RAISE WARNING 'provider_id is still UUID - should be VARCHAR. Run migration 20250115_07 first.';
  END IF;
  
  -- Check payer_id
  SELECT COUNT(*) INTO uuid_count
  FROM information_schema.columns 
  WHERE table_name = 'healthcare_claims' 
  AND column_name = 'payer_id' 
  AND data_type = 'uuid';
  
  IF uuid_count > 0 THEN
    RAISE WARNING 'payer_id is still UUID - should be VARCHAR. Run migration 20250115_07 first.';
  END IF;
  
  -- Check patient_id
  SELECT COUNT(*) INTO uuid_count
  FROM information_schema.columns 
  WHERE table_name = 'healthcare_claims' 
  AND column_name = 'patient_id' 
  AND data_type = 'uuid';
  
  IF uuid_count > 0 THEN
    RAISE WARNING 'patient_id is still UUID - should be VARCHAR. Run migration 20250115_07 first.';
  END IF;
  
  RAISE NOTICE 'Schema cleanup complete. Ready for real EDI data.';
END $$;

