/*
  # Create Claim Providers Table
  
  1. Changes
    - Create claim_providers table for physician/provider information at claim level
    - Supports one-to-many relationship with healthcare_claims
    - Stores provider information from NM1 segments (2300/2310) between CLM and LX
    - Includes attending physician, rendering provider, operating physician, etc.
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_providers table
CREATE TABLE IF NOT EXISTS claim_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  entity_identifier_code VARCHAR(10),
  entity_identifier_desc VARCHAR(100),
  identification_code_qualifier VARCHAR(10),
  identification_code_qualifier_desc VARCHAR(100),
  primary_identifier VARCHAR(50),
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_providers_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_providers_claim_id ON claim_providers(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_providers_entity_code ON claim_providers(entity_identifier_code);
CREATE INDEX IF NOT EXISTS idx_claim_providers_identifier ON claim_providers(primary_identifier);

-- Enable RLS
ALTER TABLE claim_providers ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_providers TO authenticated;
GRANT SELECT ON claim_providers TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim providers"
  ON claim_providers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim providers"
  ON claim_providers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim providers"
  ON claim_providers
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_providers IS 'Physician/provider information at claim level from EDI 837 NM1 segments (2300/2310)';
COMMENT ON COLUMN claim_providers.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_providers.entity_identifier_code IS 'Entity code: 71=Attending, 82=Rendering, 72=Operating, 77=Service Location, etc.';
COMMENT ON COLUMN claim_providers.primary_identifier IS 'Provider identifier (usually NPI when qualifier is XX)';
COMMENT ON COLUMN claim_providers.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_providers.seg_count IS 'Segment count for validation';

