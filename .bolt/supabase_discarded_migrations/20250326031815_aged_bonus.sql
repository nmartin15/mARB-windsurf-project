/*
  # Add Sample Healthcare Claims Data

  1. Changes
    - Add sample healthcare claims data with realistic values
    - Include data for revenue leakage analysis
    - Ensure proper distribution of amounts and dates
    
  2. Security
    - No changes to RLS policies
*/

-- Insert sample healthcare claims data
INSERT INTO healthcare_claims (
  id,
  claim_id,
  total_claim_charge_amount,
  billed_amount,
  allowed_amount,
  paid_amount,
  patient_responsibility,
  provider_id,
  payer_id,
  claim_status,
  denial_reason,
  procedure_code,
  claim_submission_date,
  hospital_payment_date,
  days_to_hospital_payment,
  created_at,
  updated_at
)
SELECT
  nextval('healthcare_claims_id_seq'),
  'CLM' || TO_CHAR(2024000 + (random() * 1000)::integer, 'FM0000'),
  amount,
  amount,
  CASE 
    WHEN status = 'denied' THEN 0
    ELSE (amount * 0.8)::numeric(12,2)
  END,
  CASE 
    WHEN status = 'denied' THEN 0
    ELSE (amount * payment_ratio)::numeric(12,2)
  END,
  CASE 
    WHEN status = 'denied' THEN amount
    ELSE (amount * 0.2)::numeric(12,2)
  END,
  provider,
  payer,
  status,
  CASE 
    WHEN status = 'denied' THEN denial
    ELSE NULL
  END,
  procedure,
  submission_date,
  CASE 
    WHEN status != 'denied' THEN payment_date
    ELSE NULL
  END,
  CASE 
    WHEN status != 'denied' THEN 
      (payment_date - submission_date)::integer
    ELSE NULL
  END,
  submission_date,
  GREATEST(submission_date, payment_date)
FROM (
  SELECT 
    unnest(ARRAY['PR001', 'PR002', 'PR003', 'PR004', 'PR005']) as provider,
    unnest(ARRAY['PAY001', 'PAY002', 'PAY003']) as payer,
    unnest(ARRAY['CPT001', 'CPT002', 'CPT003', 'CPT004']) as procedure,
    unnest(ARRAY[
      'denied',
      'paid',
      'paid',
      'paid',
      'denied'
    ]) as status,
    unnest(ARRAY[
      'Missing Documentation',
      NULL,
      NULL,
      NULL,
      'Service Not Covered'
    ]) as denial,
    unnest(ARRAY[
      15000,
      25000,
      18000,
      22000,
      30000
    ])::numeric(12,2) as amount,
    unnest(ARRAY[
      0,
      0.85,
      0.75,
      0.90,
      0
    ])::numeric(4,2) as payment_ratio,
    NOW() - (random() * 90 || ' days')::interval as submission_date,
    NOW() - (random() * 30 || ' days')::interval as payment_date
  FROM generate_series(1, 100)
) as data;

-- Insert sample providers if they don't exist
INSERT INTO providers (id, name, npi)
SELECT id, name, npi
FROM (VALUES
  ('PR001', 'General Hospital', '1234567890'),
  ('PR002', 'Medical Center', '2345678901'),
  ('PR003', 'Community Health', '3456789012'),
  ('PR004', 'Specialty Clinic', '4567890123'),
  ('PR005', 'Regional Hospital', '5678901234')
) as data(id, name, npi)
ON CONFLICT (id) DO NOTHING;

-- Insert sample insurance companies if they don't exist
INSERT INTO insurance_companies (id, name, payer_id)
SELECT id, name, payer_id
FROM (VALUES
  ('PAY001', 'Blue Cross', 'BC001'),
  ('PAY002', 'United Health', 'UH001'),
  ('PAY003', 'Aetna', 'AE001')
) as data(id, name, payer_id)
ON CONFLICT (id) DO NOTHING;