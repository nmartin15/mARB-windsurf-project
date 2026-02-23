/*
  # Create Claim Lines Table
  
  1. Changes
    - Create claim_lines table for line-item charges and procedures
    - Supports one-to-many relationship with healthcare_claims
    - Stores line-level data from SV2 segments (2400)
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_lines table
CREATE TABLE IF NOT EXISTS claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  clm_line_number VARCHAR(20) NOT NULL,
  revenue_code VARCHAR(50),
  procedure_code VARCHAR(50),
  procedure_code_qualifier VARCHAR(10),
  procedure_code_qualifier_desc VARCHAR(100),
  procedure_modifier VARCHAR(10),
  line_item_charge_amount DECIMAL(12,2) NOT NULL,
  unit_basis_measurement_code VARCHAR(10),
  unit_basis_measurement_code_desc VARCHAR(100),
  service_unit_count DECIMAL(10,2),
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_lines_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE,
  
  -- Unique constraint on claim_id + line_number
  CONSTRAINT uq_claim_line 
    UNIQUE (claim_id, clm_line_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_lines_claim_id ON claim_lines(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_procedure_code ON claim_lines(procedure_code);
CREATE INDEX IF NOT EXISTS idx_claim_lines_revenue_code ON claim_lines(revenue_code);

-- Enable RLS
ALTER TABLE claim_lines ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_lines TO authenticated;
GRANT SELECT ON claim_lines TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim lines"
  ON claim_lines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim lines"
  ON claim_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim lines"
  ON claim_lines
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_lines IS 'Line-item charges and procedures for healthcare claims from EDI 837 SV2 segments';
COMMENT ON COLUMN claim_lines.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_lines.clm_line_number IS 'Line number from LX segment';
COMMENT ON COLUMN claim_lines.line_item_charge_amount IS 'Charge amount for this line - sum of all lines should equal claim total';
COMMENT ON COLUMN claim_lines.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_lines.seg_count IS 'Segment count for validation';

