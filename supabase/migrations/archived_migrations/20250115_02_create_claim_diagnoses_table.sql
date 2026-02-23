/*
  # Create Claim Diagnoses Table
  
  1. Changes
    - Create claim_diagnoses table for diagnosis codes
    - Supports one-to-many relationship with healthcare_claims
    - Stores diagnosis information from HI segments (2300)
    - Used for analysis to identify claims rejected/not paid in full by diagnosis type
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_diagnoses table
CREATE TABLE IF NOT EXISTS claim_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  diagnosis_code VARCHAR(50),
  diagnosis_code_qualifier VARCHAR(10),
  diagnosis_code_qualifier_desc VARCHAR(100),
  diagnosis_sequence INTEGER,
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_diagnoses_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_diagnoses_claim_id ON claim_diagnoses(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_diagnoses_diagnosis_code ON claim_diagnoses(diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_claim_diagnoses_qualifier ON claim_diagnoses(diagnosis_code_qualifier);

-- Enable RLS
ALTER TABLE claim_diagnoses ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_diagnoses TO authenticated;
GRANT SELECT ON claim_diagnoses TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim diagnoses"
  ON claim_diagnoses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim diagnoses"
  ON claim_diagnoses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim diagnoses"
  ON claim_diagnoses
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_diagnoses IS 'Diagnosis codes for healthcare claims from EDI 837 HI segments';
COMMENT ON COLUMN claim_diagnoses.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_diagnoses.diagnosis_code_qualifier IS 'Code qualifier: ABK/ABJ=Principal, ABF=Other, etc.';
COMMENT ON COLUMN claim_diagnoses.diagnosis_sequence IS 'Sequence number: 1 for principal, 2+ for other diagnoses';
COMMENT ON COLUMN claim_diagnoses.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_diagnoses.seg_count IS 'Segment count for validation';

