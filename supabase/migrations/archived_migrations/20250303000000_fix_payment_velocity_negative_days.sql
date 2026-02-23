/*
  # Fix Payment Velocity Function - Negative Days Issue

  1. Changes
    - Fix calculation to use hospital_payment_date instead of updated_at
    - Ensure days_to_payment is always positive (clamp to 0 if negative)
    - Only calculate when hospital_payment_date exists and is after service_date_start
    
  2. Security
    - Maintains existing permissions
*/

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS get_payment_velocity(TEXT);

CREATE OR REPLACE FUNCTION get_payment_velocity(period TEXT)
RETURNS TABLE (
  "month" TEXT,
  "amount" NUMERIC,
  "disputes_closed" INTEGER,
  "days_to_payment" NUMERIC
) AS $$
DECLARE
  start_date DATE;
  end_date DATE := CURRENT_DATE;
  debug_msg TEXT;
BEGIN
  -- Calculate start date based on period
  CASE period
    WHEN '1M' THEN start_date := end_date - INTERVAL '1 month';
    WHEN '3M' THEN start_date := end_date - INTERVAL '3 months';
    WHEN '6M' THEN start_date := end_date - INTERVAL '6 months';
    WHEN '1Y' THEN start_date := end_date - INTERVAL '1 year';
    WHEN 'YTD' THEN start_date := DATE_TRUNC('year', end_date);
    WHEN '1D' THEN start_date := end_date - INTERVAL '1 day';
    WHEN '1W' THEN start_date := end_date - INTERVAL '1 week';
    ELSE start_date := end_date - INTERVAL '3 months';
  END CASE;

  -- Return actual data
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', service_date_start::DATE), 'Mon') AS data_month,
      EXTRACT(MONTH FROM service_date_start::DATE) AS month_num,
      EXTRACT(YEAR FROM service_date_start::DATE) AS year,
      SUM(total_claim_charge_amount::NUMERIC) AS total_amount,
      COUNT(CASE WHEN claim_status = 'Closed' OR claim_status = 'Approved' THEN 1 END)::INTEGER AS disputes_closed_count,
      AVG(CASE 
          WHEN hospital_payment_date IS NOT NULL 
            AND service_date_start IS NOT NULL
            AND hospital_payment_date::DATE >= service_date_start::DATE
          THEN GREATEST(0, (hospital_payment_date::DATE - service_date_start::DATE))
          ELSE NULL 
        END)::NUMERIC AS avg_days_to_payment
    FROM healthcare_claims
    WHERE service_date_start::DATE BETWEEN start_date AND end_date
    GROUP BY 
      DATE_TRUNC('month', service_date_start::DATE),
      EXTRACT(MONTH FROM service_date_start::DATE),
      EXTRACT(YEAR FROM service_date_start::DATE)
  )
  SELECT 
    data_month::TEXT AS "month",
    total_amount::NUMERIC AS "amount",
    disputes_closed_count::INTEGER AS "disputes_closed",
    COALESCE(avg_days_to_payment, 0)::NUMERIC AS "days_to_payment"
  FROM monthly_data
  ORDER BY year, month_num;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_payment_velocity(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_velocity(TEXT) TO anon;

