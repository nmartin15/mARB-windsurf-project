-- Create a function to calculate payment velocity metrics
CREATE OR REPLACE FUNCTION get_payment_velocity(start_date timestamp, end_date timestamp)
RETURNS TABLE (
  month text,
  disputes_closed integer,
  days_to_payment numeric
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      to_char(date_trunc('month', created_at), 'Mon YYYY') as month,
      COUNT(*) as disputes_closed,
      AVG(EXTRACT(DAY FROM (paid_date - created_at))) as days_to_payment
    FROM healthcare_claims
    WHERE 
      created_at BETWEEN start_date AND end_date
      AND paid_date IS NOT NULL
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at)
  )
  SELECT 
    month,
    disputes_closed,
    COALESCE(days_to_payment, 0) as days_to_payment
  FROM monthly_data;
END;
$$;
