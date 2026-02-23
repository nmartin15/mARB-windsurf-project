-- Create a function to calculate trend analysis data
CREATE OR REPLACE FUNCTION get_trend_data(period TEXT)
RETURNS TABLE (
  date TEXT,
  claims INTEGER,
  amount NUMERIC
) AS $$
DECLARE
  start_date DATE;
  end_date DATE := CURRENT_DATE;
  interval_unit TEXT;
  date_format TEXT;
BEGIN
  -- Calculate start date and determine grouping interval based on period
  CASE period
    WHEN '1M' THEN 
      start_date := end_date - INTERVAL '1 month';
      interval_unit := 'day';
      date_format := 'YYYY-MM-DD';
    WHEN '3M' THEN 
      start_date := end_date - INTERVAL '3 months';
      interval_unit := 'week';
      date_format := 'YYYY-MM-DD';
    WHEN '6M' THEN 
      start_date := end_date - INTERVAL '6 months';
      interval_unit := 'month';
      date_format := 'YYYY-MM-01';
    WHEN '1Y' THEN 
      start_date := end_date - INTERVAL '1 year';
      interval_unit := 'month';
      date_format := 'YYYY-MM-01';
    WHEN 'YTD' THEN 
      start_date := DATE_TRUNC('year', end_date);
      interval_unit := 'month';
      date_format := 'YYYY-MM-01';
    ELSE 
      start_date := end_date - INTERVAL '3 months';
      interval_unit := 'week';
      date_format := 'YYYY-MM-DD';
  END CASE;

  RETURN QUERY
  WITH trend_data AS (
    SELECT
      TO_CHAR(DATE_TRUNC(interval_unit, service_date_start::DATE), date_format) AS formatted_date,
      COUNT(*) AS claim_count,
      SUM(total_claim_charge_amount::NUMERIC) AS total_amount
    FROM healthcare_claims
    WHERE service_date_start::DATE BETWEEN start_date AND end_date
    GROUP BY DATE_TRUNC(interval_unit, service_date_start::DATE)
    ORDER BY DATE_TRUNC(interval_unit, service_date_start::DATE)
  )
  SELECT 
    formatted_date AS date,
    claim_count AS claims,
    total_amount AS amount
  FROM trend_data;
END;
$$ LANGUAGE plpgsql;
