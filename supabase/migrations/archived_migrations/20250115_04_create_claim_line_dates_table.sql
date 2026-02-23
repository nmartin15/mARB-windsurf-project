/*
  # Create Claim Line Dates Table
  
  1. Changes
    - Create claim_line_dates table for service dates and other dates for each claim line
    - Supports one-to-many relationship with claim_lines
    - Stores date information from DTP segments (2400) between SV2 and next segment
    - Service date (472) is primary date for line-level service
    
  2. Security
    - Enable RLS
    - Grant appropriate permissions
*/

-- Create claim_line_dates table
CREATE TABLE IF NOT EXISTS claim_line_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  clm_line_number VARCHAR(20) NOT NULL,
  date_qualifier VARCHAR(10) NOT NULL,
  date_qualifier_desc VARCHAR(100),
  date_value VARCHAR(20),
  date_format_qualifier VARCHAR(10),
  date_format_qualifier_desc VARCHAR(100),
  file_name VARCHAR(255),
  seg_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to healthcare_claims
  CONSTRAINT fk_claim_line_dates_claim_id 
    FOREIGN KEY (claim_id) 
    REFERENCES healthcare_claims(claim_id) 
    ON DELETE CASCADE,
  
  -- Foreign key to claim_lines (optional, if claim_lines exists)
  CONSTRAINT fk_claim_line_dates_line 
    FOREIGN KEY (claim_id, clm_line_number) 
    REFERENCES claim_lines(claim_id, clm_line_number) 
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_line_dates_claim_id ON claim_line_dates(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_line_dates_line ON claim_line_dates(claim_id, clm_line_number);
CREATE INDEX IF NOT EXISTS idx_claim_line_dates_qualifier ON claim_line_dates(date_qualifier);
CREATE INDEX IF NOT EXISTS idx_claim_line_dates_value ON claim_line_dates(date_value);

-- Enable RLS
ALTER TABLE claim_line_dates ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_line_dates TO authenticated;
GRANT SELECT ON claim_line_dates TO anon;

-- Create policies
CREATE POLICY "Authenticated users can view claim line dates"
  ON claim_line_dates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim line dates"
  ON claim_line_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim line dates"
  ON claim_line_dates
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE claim_line_dates IS 'Service dates and other dates for each claim line from EDI 837 DTP segments (2400)';
COMMENT ON COLUMN claim_line_dates.claim_id IS 'Foreign key to healthcare_claims.claim_id';
COMMENT ON COLUMN claim_line_dates.clm_line_number IS 'Line number matching claim_lines.clm_line_number';
COMMENT ON COLUMN claim_line_dates.date_qualifier IS 'Date qualifier code: 472=Service Date (primary), 434=Statement, 435=Admission, etc.';
COMMENT ON COLUMN claim_line_dates.date_value IS 'Date value in EDI format (CCYYMMDD or CCYYMMDD-CCYYMMDD)';
COMMENT ON COLUMN claim_line_dates.file_name IS 'Source EDI file name';
COMMENT ON COLUMN claim_line_dates.seg_count IS 'Segment count for validation';

