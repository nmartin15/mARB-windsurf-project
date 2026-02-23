-- Create a function to calculate payment velocity data
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
  WITH monthly_data AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', service_date_start::DATE), 'Mon') AS month,
      EXTRACT(MONTH FROM service_date_start::DATE) AS month_num,
      EXTRACT(YEAR FROM service_date_start::DATE) AS year,
      SUM(total_claim_charge_amount::NUMERIC) AS total_amount,
      COUNT(CASE WHEN claim_status = 'Closed' THEN 1 END) AS disputes_closed,
      AVG(CASE 
          WHEN payment_date IS NOT NULL AND service_date_start IS NOT NULL 
          THEN (payment_date::DATE - service_date_start::DATE) 
          ELSE NULL 
        END) AS avg_days_to_payment
    FROM healthcare_claims
    WHERE service_date_start::DATE BETWEEN start_date AND end_date
    GROUP BY 
      DATE_TRUNC('month', service_date_start::DATE),
      EXTRACT(MONTH FROM service_date_start::DATE),
      EXTRACT(YEAR FROM service_date_start::DATE)
  )
  SELECT 
    month,
    total_amount AS amount,
    disputes_closed,
    COALESCE(avg_days_to_payment, 0) AS days_to_payment
  FROM monthly_data
  ORDER BY year, month_num;
END;
$$ LANGUAGE plpgsql;
