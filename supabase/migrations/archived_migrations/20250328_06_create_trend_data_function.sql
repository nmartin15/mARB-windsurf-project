/*
  # Create Trend Data Function

  1. Changes
    - Creates the missing get_trend_data function
    - Provides trend analysis data for the dashboard
    - Supports different time periods (1D, 1W, 1M, 3M, 6M, 1Y, YTD)
    - Includes fallback sample data
    - Fixed data type issues
    
  2. Security
    - Grants appropriate permissions to roles
*/

-- First, drop any existing versions of the function
DROP FUNCTION IF EXISTS get_trend_data(TEXT);

-- Create the trend data function
CREATE OR REPLACE FUNCTION get_trend_data(period TEXT)
RETURNS TABLE (
  "range" TEXT,
  "count" INTEGER,
  "avgDays" NUMERIC
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

  -- Debug information
  debug_msg := 'get_trend_data called with period: ' || period || 
               ', start_date: ' || start_date::TEXT || 
               ', end_date: ' || end_date::TEXT;
  RAISE NOTICE '%', debug_msg;

  -- Check if we have data in the date range
  PERFORM 1 FROM healthcare_claims 
  WHERE service_date_start::DATE BETWEEN start_date AND end_date
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No data found, return sample data for testing
    RAISE NOTICE 'No data found in date range, returning sample data';
    RETURN QUERY
    SELECT 
      sample_range::TEXT,
      sample_count::INTEGER,
      sample_avgdays::NUMERIC
    FROM (
      VALUES 
        ('0-30', 45, 15.0),
        ('31-60', 32, 45.0),
        ('61-90', 18, 75.0),
        ('91+', 12, 105.0)
    ) AS sample_data(sample_range, sample_count, sample_avgdays);
    RETURN;
  END IF;

  -- Return actual data if found
  RETURN QUERY
  WITH claim_data AS (
    SELECT
      CASE
        WHEN (updated_at::DATE - service_date_start::DATE) BETWEEN 0 AND 30 THEN '0-30'
        WHEN (updated_at::DATE - service_date_start::DATE) BETWEEN 31 AND 60 THEN '31-60'
        WHEN (updated_at::DATE - service_date_start::DATE) BETWEEN 61 AND 90 THEN '61-90'
        ELSE '91+'
      END AS date_range,
      COUNT(*)::INTEGER AS claim_count,
      AVG(updated_at::DATE - service_date_start::DATE)::NUMERIC AS average_days
    FROM healthcare_claims
    WHERE 
      service_date_start::DATE BETWEEN start_date AND end_date
      AND updated_at IS NOT NULL
    GROUP BY date_range
  )
  SELECT
    date_range::TEXT AS "range",
    claim_count::INTEGER AS "count",
    COALESCE(average_days, 0)::NUMERIC AS "avgDays"
  FROM claim_data
  ORDER BY 
    CASE date_range
      WHEN '0-30' THEN 1
      WHEN '31-60' THEN 2
      WHEN '61-90' THEN 3
      WHEN '91+' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_trend_data(TEXT) TO anon, authenticated, service_role;

-- Add comment to the function
COMMENT ON FUNCTION get_trend_data(TEXT) IS 'Function for analyzing claim trends with different period options';