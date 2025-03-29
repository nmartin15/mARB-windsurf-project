/*
  # Create test user

  1. Changes
    - Create a test user for development purposes
    - Set up initial password for testing
    - Create proper identity record with provider_id
    
  2. Security
    - Password is securely hashed
    - User is created with authenticated role
*/

-- Enable the required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the user with a secure password
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert the user and store the ID
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_sent_at
  ) VALUES (
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test@healthcare.com',
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    crypt('test123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;
  
  -- Set identities for the user with provider_id
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    'test@healthcare.com',
    jsonb_build_object('sub', new_user_id::text, 'email', 'test@healthcare.com'),
    'email',
    NOW(),
    NOW(),
    NOW()
  );
END $$;