/*
  # Rollback recent changes

  This migration safely rolls back the previous migrations by:
  1. Dropping tables and types in the correct order
  2. Removing RLS policies
  3. Cleaning up any remaining data
*/

-- First drop the alerts table (dependent on claims)
DROP TABLE IF EXISTS alerts;

-- Then drop the claims table
DROP TABLE IF EXISTS claims;

-- Drop the custom types
DROP TYPE IF EXISTS alert_severity;
DROP TYPE IF EXISTS claim_status;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Clean up test user data
DO $$
DECLARE
  user_to_delete uuid;
BEGIN
  -- Get the user ID first
  SELECT id INTO user_to_delete FROM auth.users WHERE email = 'test@healthcare.com';
  
  IF user_to_delete IS NOT NULL THEN
    -- Delete from identities
    DELETE FROM auth.identities WHERE user_id = user_to_delete;
    -- Delete the user
    DELETE FROM auth.users WHERE id = user_to_delete;
  END IF;
END $$;