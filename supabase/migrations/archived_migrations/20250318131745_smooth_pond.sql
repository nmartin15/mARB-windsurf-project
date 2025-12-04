/*
  # Fix test user authentication with provider_id

  1. Changes
    - Clean up existing test user and related data
    - Recreate test user with correct authentication setup including provider_id
    - Add sample claims data
    
  2. Security
    - Password is properly hashed using Supabase's auth schema
    - User is created with correct authentication setup
*/

-- First, clean up existing test user and related data
DO $$
DECLARE
  user_to_delete uuid;
BEGIN
  -- Get the user ID first
  SELECT id INTO user_to_delete FROM auth.users WHERE email = 'test@healthcare.com';
  
  IF user_to_delete IS NOT NULL THEN
    -- Delete related claims first (this will cascade to alerts due to ON DELETE CASCADE)
    DELETE FROM claims WHERE user_id = user_to_delete;
    -- Delete from identities
    DELETE FROM auth.identities WHERE user_id = user_to_delete;
    -- Finally delete the user
    DELETE FROM auth.users WHERE id = user_to_delete;
  END IF;
END $$;

-- Create the test user with proper auth setup
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_sent_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test@healthcare.com',
    crypt('test123456', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    now(),
    now(),
    now(),
    now()
  );

  -- Insert into auth.identities with provider_id
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', 'test@healthcare.com'
    ),
    'email',
    'test@healthcare.com',
    now(),
    now(),
    now()
  );

  -- Create sample claims for the new user
  INSERT INTO claims (amount, status, provider, user_id) VALUES
    (25000, 'open', 'Aetna', new_user_id),
    (15000, 'in_negotiation', 'Cigna', new_user_id);
END $$;