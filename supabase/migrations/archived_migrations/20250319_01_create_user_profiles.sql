/*
  # Add Healthcare Claims Table

  1. New Table
    - healthcare_claims
      - Primary identifier fields
      - Claim details and amounts
      - Facility information
      - Service dates
      - Admission details
      - Status and filing information
      - Timestamps
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS healthcare_claims (
  id integer PRIMARY KEY,
  claim_id varchar NOT NULL,
  total_claim_charge_amount numeric,
  facility_type_code varchar,
  facility_type_desc varchar,
  facility_code_qualifier varchar,
  facility_code_qualifier_desc varchar,
  claim_frequency_type_code varchar,
  claim_frequency_type_desc varchar,
  service_date_start varchar,
  service_date_end varchar,
  admission_type_code varchar,
  admission_type_desc varchar,
  admission_source_code varchar,
  admission_source_desc varchar,
  patient_status_code varchar,
  patient_status_desc varchar,
  claim_filing_indicator_code varchar,
  claim_filing_indicator_desc varchar,
  assignment_code varchar,
  assignment_desc varchar,
  benefits_assignment varchar,
  benefits_assignment_desc varchar,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE healthcare_claims ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all users to view healthcare claims"
  ON healthcare_claims
  FOR SELECT
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON healthcare_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for commonly queried fields
CREATE INDEX idx_healthcare_claims_claim_id ON healthcare_claims(claim_id);
CREATE INDEX idx_healthcare_claims_service_dates ON healthcare_claims(service_date_start, service_date_end);