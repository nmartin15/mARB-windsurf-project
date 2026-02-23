/*
  # Large-Scale 837/835 Synthetic Claims Dataset
  
  Generates 150 realistic healthcare claims matching 837I/835 format.
  Uses PostgreSQL functions to create varied, realistic data.
*/

-- Create temporary arrays for realistic variations
DO $$
DECLARE
  claim_counter INTEGER := 3001;
  
  -- Payer types matching 837 filing indicators
  payers TEXT[] := ARRAY['MA', 'MB', 'MC', 'CI', 'BL', 'CH', 'WC', 'OF'];
  payer_names TEXT[] := ARRAY[
    'Medicare Part A', 'Medicare Part B', 'Medicaid', 'Commercial Insurance',
    'Blue Cross Blue Shield', 'CHAMPUS/TRICARE', 'Workers Compensation', 'Other'
  ];
  
  -- Facility types from 837I
  facility_codes TEXT[] := ARRAY['21', '22', '23', '83'];
  facility_descs TEXT[] := ARRAY[
    'Inpatient Hospital', 'On Campus Outpatient Hospital', 
    'Emergency Room - Hospital', 'Ambulatory Surgical Center'
  ];
  
  -- Common CPT codes
  cpt_codes TEXT[] := ARRAY[
    '99223', '99291', '99285', '99284', '99283', '99214', '99215', 
    '93000', '70450', '36415', '80053', '99222', '99221'
  ];
  
  -- Common ICD-10 codes
  icd_codes TEXT[] := ARRAY[
    'I50.9', 'J44.1', 'I21.9', 'E11.9', 'I10', 'N18.3', 'J96.00', 
    'K80.00', 'S72.001A', 'M25.511', 'R07.9', 'I48.91', 'G89.29'
  ];
  
  -- NPI pool
  npi_pool TEXT[] := ARRAY[
    '1234567890', '1234567891', '1234567892', '1234567893', '1234567894'
  ];
  
  -- Claim statuses and denial reasons
  statuses TEXT[] := ARRAY['paid', 'paid', 'paid', 'denied', 'pending', 'paid'];
  denial_reasons TEXT[] := ARRAY[
    NULL, NULL, NULL, 'Prior Authorization Required', NULL, NULL,
    'Not Medically Necessary', 'Duplicate Claim', 'Coding Error', 
    'Missing Documentation', 'Timely Filing Limit'
  ];
  
  -- Variables for each claim
  payer_idx INTEGER;
  facility_idx INTEGER;
  claim_amt NUMERIC;
  billed_amt NUMERIC;
  allowed_amt NUMERIC;
  paid_amt NUMERIC;
  status_idx INTEGER;
  service_date DATE;
  submission_date DATE;
  payment_date DATE;
  days_old INTEGER;
  payment_days INTEGER;
  is_denied BOOLEAN;
  
BEGIN
  -- Generate 150 claims
  FOR i IN 1..150 LOOP
    -- Random selections
    payer_idx := 1 + floor(random() * array_length(payers, 1))::INTEGER;
    facility_idx := 1 + floor(random() * array_length(facility_codes, 1))::INTEGER;
    status_idx := 1 + floor(random() * array_length(statuses, 1))::INTEGER;
    
    -- Generate realistic amounts
    claim_amt := (5000 + random() * 95000)::NUMERIC(10,2);
    billed_amt := claim_amt;
    
    -- Determine if denied
    is_denied := statuses[status_idx] = 'denied';
    
    IF is_denied THEN
      allowed_amt := 0;
      paid_amt := 0;
    ELSIF statuses[status_idx] = 'pending' THEN
      allowed_amt := NULL;
      paid_amt := NULL;
    ELSE
      -- Paid claims: allowed is 70-95% of billed, paid is 90-100% of allowed
      allowed_amt := (billed_amt * (0.70 + random() * 0.25))::NUMERIC(10,2);
      paid_amt := (allowed_amt * (0.90 + random() * 0.10))::NUMERIC(10,2);
    END IF;
    
    -- Generate dates
    days_old := floor(random() * 180)::INTEGER; -- 0-180 days old
    service_date := CURRENT_DATE - (days_old || ' days')::INTERVAL;
    submission_date := service_date + (2 + floor(random() * 8))::INTEGER; -- 2-10 days after service
    
    IF is_denied OR statuses[status_idx] = 'pending' THEN
      payment_date := NULL;
      payment_days := NULL;
    ELSE
      payment_days := 7 + floor(random() * 60)::INTEGER; -- 7-67 days
      payment_date := submission_date + (payment_days || ' days')::INTERVAL;
    END IF;
    
    -- Insert the claim
    INSERT INTO healthcare_claims (
      id, claim_id, total_claim_charge_amount, billed_amount, allowed_amount,
      paid_amount, patient_responsibility, facility_type_code, facility_type_desc,
      claim_frequency_type_code, claim_frequency_type_desc,
      service_date_start, service_date_end, claim_filing_indicator_code,
      claim_filing_indicator_desc, claim_status, denial_reason,
      provider_id, payer_id, procedure_code, diagnosis_code,
      claim_submission_date, hospital_payment_date, days_to_hospital_payment,
      billing_provider_npi, attending_provider_npi, created_at, updated_at
    ) VALUES (
      claim_counter,
      'CLM837-' || LPAD(claim_counter::TEXT, 6, '0'),
      claim_amt,
      billed_amt,
      allowed_amt,
      paid_amt,
      COALESCE(billed_amt - COALESCE(paid_amt, 0), 0),
      facility_codes[facility_idx],
      facility_descs[facility_idx],
      '1',
      'Admit Through Discharge',
      service_date,
      service_date + (floor(random() * 5)::INTEGER || ' days')::INTERVAL,
      payers[payer_idx],
      payer_names[payer_idx],
      statuses[status_idx],
      CASE WHEN is_denied THEN denial_reasons[1 + floor(random() * array_length(denial_reasons, 1))::INTEGER] ELSE NULL END,
      npi_pool[1 + floor(random() * array_length(npi_pool, 1))::INTEGER],
      'PAY' || LPAD((1 + floor(random() * 10)::INTEGER)::TEXT, 4, '0'),
      cpt_codes[1 + floor(random() * array_length(cpt_codes, 1))::INTEGER],
      icd_codes[1 + floor(random() * array_length(icd_codes, 1))::INTEGER],
      submission_date,
      payment_date,
      payment_days,
      npi_pool[1 + floor(random() * array_length(npi_pool, 1))::INTEGER],
      npi_pool[1 + floor(random() * array_length(npi_pool, 1))::INTEGER],
      submission_date,
      COALESCE(payment_date, submission_date + (floor(random() * 30)::INTEGER || ' days')::INTERVAL)
    );
    
    claim_counter := claim_counter + 1;
  END LOOP;
END $$;

-- Update statistics
ANALYZE healthcare_claims;

-- Verify count
DO $$
DECLARE
  claim_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO claim_count FROM healthcare_claims;
  RAISE NOTICE 'Total claims in database: %', claim_count;
END $$;
