/*
  # Ensure VARCHAR IDs in healthcare_claims table
  
  1. Changes
    - Ensure provider_id, payer_id, and patient_id are VARCHAR (not UUID)
    - These must match EDI output which provides string identifiers
    - Add constraints to ensure data consistency
    
  2. Security
    - No changes to security model
*/

-- Check and alter provider_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'provider_id' 
    AND data_type = 'uuid'
  ) THEN
    -- Convert UUID to VARCHAR if it exists as UUID
    ALTER TABLE healthcare_claims 
    ALTER COLUMN provider_id TYPE VARCHAR(50) USING provider_id::TEXT;
    
    RAISE NOTICE 'Converted provider_id from UUID to VARCHAR(50)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'provider_id'
  ) THEN
    -- Add column if it doesn't exist
    ALTER TABLE healthcare_claims 
    ADD COLUMN provider_id VARCHAR(50);
    
    RAISE NOTICE 'Added provider_id as VARCHAR(50)';
  ELSE
    -- Ensure it's VARCHAR(50) if it exists but different size
    ALTER TABLE healthcare_claims 
    ALTER COLUMN provider_id TYPE VARCHAR(50);
    
    RAISE NOTICE 'Ensured provider_id is VARCHAR(50)';
  END IF;
END $$;

-- Check and alter payer_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'payer_id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE healthcare_claims 
    ALTER COLUMN payer_id TYPE VARCHAR(50) USING payer_id::TEXT;
    
    RAISE NOTICE 'Converted payer_id from UUID to VARCHAR(50)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'payer_id'
  ) THEN
    ALTER TABLE healthcare_claims 
    ADD COLUMN payer_id VARCHAR(50);
    
    RAISE NOTICE 'Added payer_id as VARCHAR(50)';
  ELSE
    ALTER TABLE healthcare_claims 
    ALTER COLUMN payer_id TYPE VARCHAR(50);
    
    RAISE NOTICE 'Ensured payer_id is VARCHAR(50)';
  END IF;
END $$;

-- Check and alter patient_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'patient_id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE healthcare_claims 
    ALTER COLUMN patient_id TYPE VARCHAR(50) USING patient_id::TEXT;
    
    RAISE NOTICE 'Converted patient_id from UUID to VARCHAR(50)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'healthcare_claims' 
    AND column_name = 'patient_id'
  ) THEN
    ALTER TABLE healthcare_claims 
    ADD COLUMN patient_id VARCHAR(50);
    
    RAISE NOTICE 'Added patient_id as VARCHAR(50)';
  ELSE
    ALTER TABLE healthcare_claims 
    ALTER COLUMN patient_id TYPE VARCHAR(50);
    
    RAISE NOTICE 'Ensured patient_id is VARCHAR(50)';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN healthcare_claims.provider_id IS 'Provider identifier from EDI (VARCHAR to match EDI string output, not UUID)';
COMMENT ON COLUMN healthcare_claims.payer_id IS 'Payer identifier from EDI (VARCHAR to match EDI string output, not UUID)';
COMMENT ON COLUMN healthcare_claims.patient_id IS 'Patient identifier from EDI (VARCHAR to match EDI string output, not UUID)';

