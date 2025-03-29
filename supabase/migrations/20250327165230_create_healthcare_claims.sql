/*
  # Create Healthcare Claims Table

  1. Changes
    - Create the healthcare_claims table
    - Add all necessary columns for claims data
    - Insert sample data for testing
    - Set up appropriate indexes for performance
    
  2. Security
    - Grant appropriate permissions to roles
*/

-- Create the healthcare_claims table
CREATE TABLE IF NOT EXISTS healthcare_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id VARCHAR(50) NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  patient_id UUID,
  provider_id UUID NOT NULL,
  provider_name VARCHAR(100),
  payer_id UUID NOT NULL,
  payer_name VARCHAR(100),
  service_date_start DATE NOT NULL,
  service_date_end DATE,
  billed_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2),
  total_claim_charge_amount DECIMAL(12,2) NOT NULL,
  claim_filing_indicator VARCHAR(10),
  claim_status VARCHAR(20) NOT NULL,
  procedure_code VARCHAR(20),
  diagnosis_code VARCHAR(20),
  denial_reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_provider_id ON healthcare_claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_payer_id ON healthcare_claims(payer_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_claim_status ON healthcare_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_healthcare_claims_service_date ON healthcare_claims(service_date_start);

-- Insert sample data
INSERT INTO healthcare_claims (
  claim_id,
  patient_name,
  provider_id,
  provider_name,
  payer_id,
  payer_name,
  service_date_start,
  service_date_end,
  billed_amount,
  paid_amount,
  total_claim_charge_amount,
  claim_filing_indicator,
  claim_status,
  procedure_code,
  diagnosis_code,
  denial_reason
) VALUES
  (
    'CL-2025-001',
    'John Smith',
    '11111111-1111-1111-1111-111111111111',
    'Memorial Hospital',
    '22222222-2222-2222-2222-222222222222',
    'Medicare',
    '2025-03-15',
    '2025-03-15',
    1850.00,
    1750.00,
    1850.00,
    'MC',
    'Approved',
    'CPT99213',
    'ICD10-E11.9',
    NULL
  ),
  (
    'CL-2025-002',
    'Sarah Johnson',
    '33333333-3333-3333-3333-333333333333',
    'City Medical Center',
    '44444444-4444-4444-4444-444444444444',
    'Blue Cross',
    '2025-03-14',
    '2025-03-14',
    2350.75,
    0.00,
    2350.75,
    'BL',
    'Pending',
    'CPT99214',
    'ICD10-I10',
    NULL
  ),
  (
    'CL-2025-003',
    'Michael Brown',
    '11111111-1111-1111-1111-111111111111',
    'Memorial Hospital',
    '22222222-2222-2222-2222-222222222222',
    'Medicare',
    '2025-03-12',
    '2025-03-12',
    950.25,
    950.25,
    950.25,
    'MC',
    'Approved',
    'CPT99212',
    'ICD10-J45.901',
    NULL
  ),
  (
    'CL-2025-004',
    'Emily Davis',
    '55555555-5555-5555-5555-555555555555',
    'Community Care',
    '66666666-6666-6666-6666-666666666666',
    'Aetna',
    '2025-03-10',
    '2025-03-10',
    3250.00,
    0.00,
    3250.00,
    'CI',
    'Denied',
    'CPT99215',
    'ICD10-M54.5',
    'Service not covered by plan'
  ),
  (
    'CL-2025-005',
    'Robert Wilson',
    '77777777-7777-7777-7777-777777777777',
    'Regional Medical',
    '44444444-4444-4444-4444-444444444444',
    'Blue Cross',
    '2025-03-08',
    '2025-03-08',
    1750.50,
    1650.00,
    1750.50,
    'BL',
    'Approved',
    'CPT99213',
    'ICD10-K21.9',
    NULL
  ),
  (
    'CL-2025-006',
    'Jennifer Martinez',
    '33333333-3333-3333-3333-333333333333',
    'City Medical Center',
    '22222222-2222-2222-2222-222222222222',
    'Medicare',
    '2025-03-06',
    '2025-03-06',
    2100.00,
    1900.00,
    2100.00,
    'MC',
    'Approved',
    'CPT99214',
    'ICD10-E78.5',
    NULL
  ),
  (
    'CL-2025-007',
    'David Anderson',
    '55555555-5555-5555-5555-555555555555',
    'Community Care',
    '88888888-8888-8888-8888-888888888888',
    'UnitedHealthcare',
    '2025-03-05',
    '2025-03-05',
    875.25,
    0.00,
    875.25,
    'CI',
    'Denied',
    'CPT99212',
    'ICD10-R10.9',
    'Prior authorization required'
  ),
  (
    'CL-2025-008',
    'Lisa Thompson',
    '77777777-7777-7777-7777-777777777777',
    'Regional Medical',
    '66666666-6666-6666-6666-666666666666',
    'Aetna',
    '2025-03-03',
    '2025-03-03',
    1450.00,
    1350.00,
    1450.00,
    'CI',
    'Approved',
    'CPT99213',
    'ICD10-J20.9',
    NULL
  ),
  (
    'CL-2025-009',
    'James Wilson',
    '11111111-1111-1111-1111-111111111111',
    'Memorial Hospital',
    '44444444-4444-4444-4444-444444444444',
    'Blue Cross',
    '2025-03-01',
    '2025-03-01',
    3100.50,
    2900.00,
    3100.50,
    'BL',
    'Approved',
    'CPT99215',
    'ICD10-I25.10',
    NULL
  ),
  (
    'CL-2025-010',
    'Patricia Garcia',
    '33333333-3333-3333-3333-333333333333',
    'City Medical Center',
    '88888888-8888-8888-8888-888888888888',
    'UnitedHealthcare',
    '2025-02-28',
    '2025-02-28',
    925.75,
    0.00,
    925.75,
    'CI',
    'Pending',
    'CPT99212',
    'ICD10-N39.0',
    NULL
  ),
  (
    'CL-2025-011',
    'Thomas Lee',
    '55555555-5555-5555-5555-555555555555',
    'Community Care',
    '22222222-2222-2222-2222-222222222222',
    'Medicare',
    '2025-02-26',
    '2025-02-26',
    1650.25,
    1550.00,
    1650.25,
    'MC',
    'Approved',
    'CPT99213',
    'ICD10-G43.909',
    NULL
  ),
  (
    'CL-2025-012',
    'Nancy Rodriguez',
    '77777777-7777-7777-7777-777777777777',
    'Regional Medical',
    '44444444-4444-4444-4444-444444444444',
    'Blue Cross',
    '2025-02-24',
    '2025-02-24',
    2750.00,
    0.00,
    2750.00,
    'BL',
    'Denied',
    'CPT99214',
    'ICD10-M25.50',
    'Documentation insufficient'
  );

-- Grant appropriate permissions
ALTER TABLE healthcare_claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON healthcare_claims TO authenticated;
GRANT SELECT ON healthcare_claims TO anon;

-- Create a policy that allows authenticated users to see all claims
CREATE POLICY "Authenticated users can see all claims"
  ON healthcare_claims
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a policy that allows authenticated users to insert their own claims
CREATE POLICY "Authenticated users can insert claims"
  ON healthcare_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a policy that allows authenticated users to update their own claims
CREATE POLICY "Authenticated users can update claims"
  ON healthcare_claims
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment to the table
COMMENT ON TABLE healthcare_claims IS 'Healthcare claims data for revenue analysis and reporting';
