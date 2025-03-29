/*
  # Add Sample Healthcare Claims Data

  1. Changes
    - Add sample healthcare claims that match the notification data
    - Ensure claim IDs match those referenced in notifications
*/

INSERT INTO healthcare_claims (
  id,
  claim_id,
  total_claim_charge_amount,
  facility_type_code,
  facility_type_desc,
  claim_frequency_type_code,
  claim_frequency_type_desc,
  service_date_start,
  service_date_end,
  claim_filing_indicator_code,
  claim_filing_indicator_desc,
  created_at,
  updated_at
)
SELECT
  nextval('healthcare_claims_id_seq'),
  claim_id,
  total_claim_charge_amount,
  facility_type_code,
  facility_type_desc,
  claim_frequency_type_code,
  claim_frequency_type_desc,
  service_date_start,
  service_date_end,
  claim_filing_indicator_code,
  claim_filing_indicator_desc,
  created_at,
  updated_at
FROM (
  VALUES
    (
      '316514501',
      1000.00,
      'HOS',
      'Hospital',
      '1',
      'Original',
      '2024-03-01',
      '2024-03-01',
      'CI',
      'Commercial Insurance Private',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    ),
    (
      '316514502',
      800.00,
      'HOS',
      'Hospital',
      '1',
      'Original',
      '2024-03-02',
      '2024-03-02',
      'MB',
      'Medicare Part A',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '3 days'
    ),
    (
      '316514503',
      1500.00,
      'HOS',
      'Hospital',
      '1',
      'Original',
      '2024-03-03',
      '2024-03-03',
      'MC',
      'Medicaid',
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '5 days'
    ),
    (
      '316514504',
      950.00,
      'HOS',
      'Hospital',
      '1',
      'Original',
      '2024-03-04',
      '2024-03-04',
      'CH',
      'CHAMPUS',
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '7 days'
    ),
    (
      '316514505',
      1200.00,
      'HOS',
      'Hospital',
      '1',
      'Original',
      '2024-03-05',
      '2024-03-05',
      'WC',
      'Workers Compensation',
      NOW() - INTERVAL '10 days',
      NOW() - INTERVAL '10 days'
    )
) AS v(
  claim_id,
  total_claim_charge_amount,
  facility_type_code,
  facility_type_desc,
  claim_frequency_type_code,
  claim_frequency_type_desc,
  service_date_start,
  service_date_end,
  claim_filing_indicator_code,
  claim_filing_indicator_desc,
  created_at,
  updated_at
)
WHERE NOT EXISTS (
  SELECT 1 FROM healthcare_claims
  WHERE claim_id = v.claim_id
);