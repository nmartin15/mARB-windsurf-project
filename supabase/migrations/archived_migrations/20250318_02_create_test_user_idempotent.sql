/*
  # Create test user if not exists

  1. Changes
    - Create a test user for development purposes (if not exists)
    - Set up initial password for testing
    - Create proper identity record with provider_id
    
  2. Security
    - Password is securely hashed
    - User is created with authenticated role
    - Checks for existing user to prevent duplicates
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Only create user if email doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'test@healthcare.com'
  ) THEN
    -- Create the user with a secure password
    INSERT INTO auth.users (
      instance_id,
      id,
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
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
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
      '',
      now(),
      '',
      null,
      '',
      '',
      null
    )
    RETURNING id INTO new_user_id;

    -- Set up identities for the user only if we created a new user
    IF new_user_id IS NOT NULL THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        new_user_id,
        new_user_id,
        json_build_object(
          'sub', new_user_id::text,
          'email', 'test@healthcare.com'
        ),
        'email',
        now(),
        now(),
        now()
      );
    END IF;
  END IF;
END $$;