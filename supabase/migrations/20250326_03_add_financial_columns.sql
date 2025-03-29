/*
  # Add Sample Healthcare Claims Data

  1. Changes
    - Reset and update sequence to avoid conflicts
    - Insert sample healthcare claims data
    - Use explicit IDs to avoid conflicts
    
  2. Security
    - No changes to security model
*/

-- Reset and update sequence to avoid conflicts
ALTER SEQUENCE healthcare_claims_id_seq RESTART WITH 1000;

-- Insert sample healthcare claims data
INSERT INTO healthcare_claims (
  id,
  claim_id,
  total_claim_charge_amount,
  billed_amount,
  allowed_amount,
  paid_amount,
  patient_responsibility,
  facility_type_code,
  facility_type_desc,
  claim_frequency_type_code,
  claim_frequency_type_desc,
  service_date_start,
  service_date_end,
  claim_filing_indicator_code,
  claim_filing_indicator_desc,
  claim_status,
  denial_reason,
  provider_id,
  payer_id,
  procedure_code,
  diagnosis_code,
  claim_submission_date,
  hospital_payment_date,
  days_to_hospital_payment,
  created_at,
  updated_at
)
VALUES
  (
    1001,
    'CLM2024001',
    25000.00,
    25000.00,
    21250.00,
    20000.00,
    5000.00,
    'HOS',
    'Hospital',
    '1',
    'Original',
    '2024-03-01',
    '2024-03-01',
    'CI',
    'Commercial',
    'paid',
    NULL,
    'P1',
    'INS1',
    '99213',
    'A123',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '15 days',
    15,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '15 days'
  ),
  (
    1002,
    'CLM2024002',
    18000.00,
    18000.00,
    0.00,
    0.00,
    18000.00,
    'HOS',
    'Hospital',
    '1',
    'Original',
    '2024-03-02',
    '2024-03-02',
    'MB',
    'Medicare',
    'denied',
    'Missing Doc',
    'P2',
    'INS2',
    '99214',
    'B456',
    NOW() - INTERVAL '25 days',
    NULL,
    NULL,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
  ),
  (
    1003,
    'CLM2024003',
    32000.00,
    32000.00,
    27200.00,
    25600.00,
    6400.00,
    'HOS',
    'Hospital',
    '1',
    'Original',
    '2024-03-03',
    '2024-03-03',
    'MC',
    'Medicaid',
    'paid',
    NULL,
    'P3',
    'INS3',
    '99215',
    'C789',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 days',
    15,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    1004,
    'CLM2024004',
    28000.00,
    28000.00,
    0.00,
    0.00,
    28000.00,
    'HOS',
    'Hospital',
    '1',
    'Original',
    '2024-03-04',
    '2024-03-04',
    'WC',
    'Workers Comp',
    'denied',
    'Auth Req',
    'P4',
    'INS1',
    '99213',
    'D012',
    NOW() - INTERVAL '15 days',
    NULL,
    NULL,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days'
  ),
  (
    1005,
    'CLM2024005',
    22000.00,
    22000.00,
    18700.00,
    17600.00,
    4400.00,
    'HOS',
    'Hospital',
    '1',
    'Original',
    '2024-03-05',
    '2024-03-05',
    'CI',
    'Commercial',
    'paid',
    NULL,
    'P5',
    'INS2',
    '99214',
    'E345',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days',
    8,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  );