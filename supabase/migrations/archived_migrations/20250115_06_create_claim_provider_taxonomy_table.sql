/*
  # Create Claim Provider Taxonomy Table
  
  1. Changes
    - Create claim_provider_taxonomy table for provider taxonomy information
    - Supports one-to-many relationship with healthcare_claims
    - Stores provider taxonomy from PRV segments (2310) between CLM and LX
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_provider_taxonomy table
CREATE TABLE IF NOT EXISTS claim_provider_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  provider_code VARCHAR(10),
  provider_code_desc VARCHAR(100),
  reference_identification_qualifier VARCHAR(10),
  reference_identification_qualifier_desc VARCHAR(100),
  provider_taxonomy_code VARCHAR(50),
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_provider_taxonomy_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_provider_taxonomy_claim_id ON claim_provider_taxonomy(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_provider_taxonomy_code ON claim_provider_taxonomy(provider_code);
CREATE INDEX IF NOT EXISTS idx_claim_provider_taxonomy_taxonomy ON claim_provider_taxonomy(provider_taxonomy_code);

-- Enable RLS
ALTER TABLE claim_provider_taxonomy ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_provider_taxonomy TO authenticated;
GRANT SELECT ON claim_provider_taxonomy TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim provider taxonomy"
  ON claim_provider_taxonomy
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim provider taxonomy"
  ON claim_provider_taxonomy
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim provider taxonomy"
  ON claim_provider_taxonomy
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_provider_taxonomy IS 'Provider taxonomy information from EDI 837 PRV segments (2310)';
COMMENT ON COLUMN claim_provider_taxonomy.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_provider_taxonomy.provider_code IS 'Provider code: AT=Attending, OP=Operating, PE=Performing, RP=Referring, etc.';
COMMENT ON COLUMN claim_provider_taxonomy.provider_taxonomy_code IS 'Healthcare Provider Taxonomy Code';
COMMENT ON COLUMN claim_provider_taxonomy.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_provider_taxonomy.seg_count IS 'Segment count for validation';

