-- Create a function to calculate trend analysis metrics
CREATE OR REPLACE FUNCTION get_trend_data(start_date timestamp, end_date timestamp)
RETURNS TABLE (
  range text,
  count integer,
  avgDays numeric
) LANGUAGE plpgsql AS $$
BEGIN
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
        WHEN paid_date IS NOT NULL THEN 
          EXTRACT(DAY FROM (paid_date - service_date_start))
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
END;
$$;
