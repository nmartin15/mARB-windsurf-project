/*
  # Trend Analysis Function

  1. Changes
    - Creates a consolidated function for trend analysis
    - Combines features from previous versions (20250327074100, 20250327063400, 20250327063200)
    - Used by the TrendAnalysisChart component in the Dashboard
    
  2. Security
    - Grants appropriate permissions to roles
*/

-- Create a function to calculate trend analysis data
CREATE OR REPLACE FUNCTION get_trend_data(period TEXT)
RETURNS TABLE (
  range TEXT,
  count INTEGER,
  avgDays NUMERIC
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

  -- For time-based trend analysis
  IF period IN ('1M', '3M', '6M', '1Y', 'YTD') THEN
    RETURN QUERY
    WITH trend_data AS (
      SELECT
        TO_CHAR(DATE_TRUNC(interval_unit, service_date_start::DATE), date_format) AS formatted_date,
        COUNT(*) AS claim_count,
        AVG(CASE 
            WHEN paid_amount IS NOT NULL AND service_date_start IS NOT NULL 
            THEN (updated_at::DATE - service_date_start::DATE) 
            ELSE NULL 
          END) AS avg_days_to_payment
      FROM healthcare_claims
      WHERE service_date_start::DATE BETWEEN start_date AND end_date
      GROUP BY DATE_TRUNC(interval_unit, service_date_start::DATE)
      ORDER BY DATE_TRUNC(interval_unit, service_date_start::DATE)
    )
    SELECT 
      formatted_date AS range,
      claim_count AS count,
      COALESCE(avg_days_to_payment, 0) AS avgDays
    FROM trend_data;
  
  -- For age-based trend analysis (default)
  ELSE
    RETURN QUERY
    WITH ranges AS (
      SELECT '0-30' as range, 0 as min_days, 30 as max_days
      UNION ALL SELECT '31-60', 31, 60
      UNION ALL SELECT '61-90', 61, 90
      UNION ALL SELECT '91-120', 91, 120
      UNION ALL SELECT '>120', 121, 999
    ),
    claim_days AS (
      SELECT 
        CASE
          WHEN paid_amount IS NOT NULL THEN 
            EXTRACT(DAY FROM (updated_at - service_date_start))
          ELSE
            EXTRACT(DAY FROM (CURRENT_DATE - service_date_start))
        END as days_to_resolution,
        service_date_start
      FROM healthcare_claims
      WHERE service_date_start BETWEEN start_date AND end_date
    )
    SELECT 
      r.range,
      COUNT(cd.days_to_resolution)::integer as count,
      COALESCE(AVG(cd.days_to_resolution), 0) as avgDays
    FROM ranges r
    LEFT JOIN claim_days cd ON 
      cd.days_to_resolution >= r.min_days AND 
      cd.days_to_resolution <= r.max_days
    GROUP BY r.range, r.min_days
    ORDER BY r.min_days;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_trend_data(TEXT) TO anon, authenticated, service_role;

-- Add comment to the function
COMMENT ON FUNCTION get_trend_data(TEXT) IS 'Function for trend analysis with different period options';

/*
  Rollback:
  DROP FUNCTION IF EXISTS get_trend_data(TEXT);
*/
