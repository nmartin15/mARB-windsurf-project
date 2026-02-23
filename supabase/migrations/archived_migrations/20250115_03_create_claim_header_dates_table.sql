/*
  # Create Claim Header Dates Table
  
  1. Changes
    - Create claim_header_dates table for all dates related to claim header
    - Supports one-to-many relationship with healthcare_claims
    - Stores date information from DTP segments (2300) between CLM and LX
    - Statement date (434) is mandatory and appears on all claims
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_header_dates table
CREATE TABLE IF NOT EXISTS claim_header_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  date_qualifier VARCHAR(10) NOT NULL,
  date_qualifier_desc VARCHAR(100),
  date_value VARCHAR(20),
  date_format_qualifier VARCHAR(10),
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_header_dates_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_header_dates_claim_id ON claim_header_dates(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_header_dates_qualifier ON claim_header_dates(date_qualifier);
CREATE INDEX IF NOT EXISTS idx_claim_header_dates_value ON claim_header_dates(date_value);

-- Enable RLS
ALTER TABLE claim_header_dates ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_header_dates TO authenticated;
GRANT SELECT ON claim_header_dates TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim header dates"
  ON claim_header_dates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim header dates"
  ON claim_header_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim header dates"
  ON claim_header_dates
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_header_dates IS 'Dates related to claim header from EDI 837 DTP segments (2300)';
COMMENT ON COLUMN claim_header_dates.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_header_dates.date_qualifier IS 'Date qualifier code: 434=Statement, 435=Admission, 096=Discharge, 472=Service, 573=Paid, etc.';
COMMENT ON COLUMN claim_header_dates.date_value IS 'Date value in EDI format (CCYYMMDD or CCYYMMDD-CCYYMMDD)';
COMMENT ON COLUMN claim_header_dates.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_header_dates.seg_count IS 'Segment count for validation';

