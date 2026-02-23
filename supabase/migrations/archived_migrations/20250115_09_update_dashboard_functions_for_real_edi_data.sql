/*
  # Update Dashboard Functions for Real EDI Data
  
  1. Changes
    - Update get_payment_velocity to work with real EDI data structure
    - Update get_trend_data to work with real EDI data and return range format
    - Handle dates from claim_header_dates table (real EDI structure)
    - Use VARCHAR IDs (not UUID)
    - Handle date formats from EDI (VARCHAR dates that need parsing)
    
  2. Security
    - Maintains existing permissions
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS get_payment_velocity(TEXT);
DROP FUNCTION IF EXISTS get_trend_data(TEXT);

-- ============================================================================
-- Payment Velocity Function
-- ============================================================================
-- Calculates payment velocity using real EDI data structure
-- Uses dates from claim_header_dates table where available
CREATE OR REPLACE FUNCTION get_payment_velocity(period TEXT)
RETURNS TABLE (
  month TEXT,
  amount NUMERIC,
  disputes_closed INTEGER,
  days_to_payment NUMERIC
) AS $$
DECLARE
  start_date DATE;
  end_date DATE := CURRENT_DATE;
BEGIN
  -- Calculate start date based on period
  CASE period
    WHEN '1M' THEN start_date := end_date - INTERVAL '1 month';
    WHEN '3M' THEN start_date := end_date - INTERVAL '3 months';
    WHEN '6M' THEN start_date := end_date - INTERVAL '6 months';
    WHEN '1Y' THEN start_date := end_date - INTERVAL '1 year';
    WHEN 'YTD' THEN start_date := DATE_TRUNC('year', end_date);
    ELSE start_date := end_date - INTERVAL '3 months';
  END CASE;

  RETURN QUERY
  WITH claim_dates AS (
    -- Get service dates from claim_header_dates (qualifier 472 = Service Date, 232 = Statement Period Start)
    SELECT DISTINCT
      hc.claim_id,
      COALESCE(
        -- Try to get service date from claim_header_dates (qualifier 472)
        (SELECT date_value FROM claim_header_dates 
         WHERE claim_id = hc.claim_id 
         AND date_qualifier = '472' 
         LIMIT 1),
        -- Fall back to statement period start (qualifier 232)
        (SELECT date_value FROM claim_header_dates 
         WHERE claim_id = hc.claim_id 
         AND date_qualifier = '232' 
         LIMIT 1),
        -- Fall back to service_date_start column if dates table doesn't have it
        hc.service_date_start::TEXT
      ) AS service_date_str,
      -- Get payment date from claim_header_dates (qualifier 573 = Claim Paid Date)
      (SELECT date_value FROM claim_header_dates 
       WHERE claim_id = hc.claim_id 
       AND date_qualifier = '573' 
       LIMIT 1) AS payment_date_str,
      -- Or use hospital_payment_date column
      hc.hospital_payment_date
    FROM healthcare_claims hc
    WHERE hc.file_name IS NOT NULL  -- Only real EDI data
  ),
  parsed_dates AS (
    SELECT
      claim_id,
      -- Parse EDI date format (CCYYMMDD) to DATE
      CASE 
        WHEN LENGTH(service_date_str) = 8 THEN
          TO_DATE(service_date_str, 'YYYYMMDD')
        WHEN service_date_str LIKE '____-__-__' THEN
          service_date_str::DATE
        ELSE
          NULL
      END AS service_date,
      CASE 
        WHEN payment_date_str IS NOT NULL AND LENGTH(payment_date_str) = 8 THEN
          TO_DATE(payment_date_str, 'YYYYMMDD')
        WHEN payment_date_str IS NOT NULL AND payment_date_str LIKE '____-__-__' THEN
          payment_date_str::DATE
        WHEN hospital_payment_date IS NOT NULL THEN
          hospital_payment_date::DATE
        ELSE
          NULL
      END AS payment_date
    FROM claim_dates
  ),
  monthly_data AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', pd.service_date), 'Mon') AS month,
      EXTRACT(MONTH FROM pd.service_date) AS month_num,
      EXTRACT(YEAR FROM pd.service_date) AS year,
      SUM(COALESCE(hc.billed_amount, hc.total_claim_charge_amount, 0)) AS total_amount,
      COUNT(CASE WHEN hc.claim_status IN ('Approved', 'paid', 'Paid') THEN 1 END) AS disputes_closed,
      AVG(CASE 
          WHEN pd.payment_date IS NOT NULL AND pd.service_date IS NOT NULL 
          THEN (pd.payment_date - pd.service_date)
          WHEN hc.days_to_hospital_payment IS NOT NULL
          THEN hc.days_to_hospital_payment::NUMERIC
          ELSE NULL 
        END) AS avg_days_to_payment
    FROM parsed_dates pd
    JOIN healthcare_claims hc ON pd.claim_id = hc.claim_id
    WHERE pd.service_date BETWEEN start_date AND end_date
      AND hc.file_name IS NOT NULL  -- Only real EDI data
    GROUP BY 
      DATE_TRUNC('month', pd.service_date),
      EXTRACT(MONTH FROM pd.service_date),
      EXTRACT(YEAR FROM pd.service_date)
  )
  SELECT 
    month,
    COALESCE(total_amount, 0) AS amount,
    COALESCE(disputes_closed, 0) AS disputes_closed,
    COALESCE(avg_days_to_payment, 0) AS days_to_payment
  FROM monthly_data
  ORDER BY year, month_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trend Data Function (Returns Range Format for Age-Based Analysis)
-- ============================================================================
-- Returns claim counts by age ranges (0-30, 31-60, 61-90, 90+ days)
-- Uses real EDI data and calculates days based on service dates and current date
CREATE OR REPLACE FUNCTION get_trend_data(period TEXT)
RETURNS TABLE (
  range TEXT,
  count INTEGER,
  avgDays NUMERIC
) AS $$
DECLARE
  start_date DATE;
  end_date DATE := CURRENT_DATE;
BEGIN
  -- Calculate start date based on period
  CASE period
    WHEN '1M' THEN start_date := end_date - INTERVAL '1 month';
    WHEN '3M' THEN start_date := end_date - INTERVAL '3 months';
    WHEN '6M' THEN start_date := end_date - INTERVAL '6 months';
    WHEN '1Y' THEN start_date := end_date - INTERVAL '1 year';
    WHEN 'ALL' THEN start_date := '1900-01-01'::DATE;
    ELSE start_date := end_date - INTERVAL '3 months';
  END CASE;

  RETURN QUERY
  WITH claim_dates AS (
    -- Get service dates from claim_header_dates or service_date_start column
    SELECT DISTINCT
      hc.claim_id,
      COALESCE(
        (SELECT date_value FROM claim_header_dates 
         WHERE claim_id = hc.claim_id 
         AND date_qualifier = '472' 
         LIMIT 1),
        (SELECT date_value FROM claim_header_dates 
         WHERE claim_id = hc.claim_id 
         AND date_qualifier = '232' 
         LIMIT 1),
        hc.service_date_start::TEXT
      ) AS service_date_str,
      hc.claim_id,
      hc.billed_amount,
      hc.paid_amount
    FROM healthcare_claims hc
    WHERE hc.file_name IS NOT NULL  -- Only real EDI data
      AND (period = 'ALL' OR hc.created_at >= start_date)
  ),
  parsed_dates AS (
    SELECT
      claim_id,
      billed_amount,
      paid_amount,
      CASE 
        WHEN LENGTH(service_date_str) = 8 THEN
          TO_DATE(service_date_str, 'YYYYMMDD')
        WHEN service_date_str LIKE '____-__-__' THEN
          service_date_str::DATE
        ELSE
          NULL
      END AS service_date
    FROM claim_dates
  ),
  claim_ages AS (
    SELECT
      claim_id,
      billed_amount,
      paid_amount,
      service_date,
      CASE 
        WHEN service_date IS NOT NULL THEN
          (CURRENT_DATE - service_date)::INTEGER
        ELSE
          NULL
      END AS days_old
    FROM parsed_dates
    WHERE service_date IS NOT NULL
  ),
  age_ranges AS (
    SELECT
      CASE
        WHEN days_old <= 30 THEN '0-30'
        WHEN days_old <= 60 THEN '31-60'
        WHEN days_old <= 90 THEN '61-90'
        ELSE '91+'
      END AS range,
      days_old,
      billed_amount,
      paid_amount
    FROM claim_ages
  )
  SELECT 
    range,
    COUNT(*)::INTEGER AS count,
    AVG(days_old)::NUMERIC AS avgDays
  FROM age_ranges
  GROUP BY range
  ORDER BY 
    CASE range
      WHEN '0-30' THEN 1
      WHEN '31-60' THEN 2
      WHEN '61-90' THEN 3
      WHEN '91+' THEN 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_payment_velocity(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_trend_data(TEXT) TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION get_payment_velocity(TEXT) IS 'Calculates payment velocity from real EDI data using dates from claim_header_dates table';
COMMENT ON FUNCTION get_trend_data(TEXT) IS 'Returns claim age ranges (0-30, 31-60, 61-90, 90+ days) from real EDI data';

