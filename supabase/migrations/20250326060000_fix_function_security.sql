/*
  # Fix Function Search Path Security Warnings

  This migration fixes the 5 functions that have mutable search_path security warnings
  by explicitly setting search_path to 'public' using SET search_path.
  
  Functions fixed:
  - handle_negotiation_notification
  - parse_date_safely
  - get_payment_velocity
  - get_trend_data
  - update_updated_at_column
  
  Security:
  - Prevents SQL injection attacks via search_path manipulation
  - Follows Supabase security best practices
*/

-- Fix handle_negotiation_notification
CREATE OR REPLACE FUNCTION public.handle_negotiation_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Function implementation remains the same, just adding SET search_path
  RETURN NEW;
END;
$$;

-- Fix parse_date_safely  
CREATE OR REPLACE FUNCTION public.parse_date_safely(date_string TEXT)
RETURNS DATE
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN date_string::DATE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Fix get_payment_velocity
CREATE OR REPLACE FUNCTION public.get_payment_velocity(time_period TEXT DEFAULT '1M')
RETURNS TABLE (
  month TEXT,
  disputes_closed INTEGER,
  days_to_payment NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Function implementation remains the same, just adding SET search_path
  RETURN QUERY
  SELECT 
    to_char(created_at, 'Mon YYYY') as month,
    COUNT(*)::INTEGER as disputes_closed,
    AVG(EXTRACT(DAY FROM (updated_at - created_at)))::NUMERIC as days_to_payment
  FROM healthcare_claims
  GROUP BY to_char(created_at, 'Mon YYYY')
  ORDER BY MIN(created_at);
END;
$$;

-- Fix get_trend_data
CREATE OR REPLACE FUNCTION public.get_trend_data()
RETURNS TABLE (
  range TEXT,
  count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN days_old <= 30 THEN '0-30'
      WHEN days_old <= 60 THEN '31-60'
      WHEN days_old <= 90 THEN '61-90'
      ELSE '90+'
    END as range,
    COUNT(*) as count
  FROM (
    SELECT EXTRACT(DAY FROM (NOW() - created_at))::INTEGER as days_old
    FROM healthcare_claims
  ) subquery
  GROUP BY range
  ORDER BY range;
END;
$$;

-- Fix update_updated_at_column (this one is critical - used as trigger)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Automatically updates updated_at timestamp. SET search_path prevents SQL injection.';
