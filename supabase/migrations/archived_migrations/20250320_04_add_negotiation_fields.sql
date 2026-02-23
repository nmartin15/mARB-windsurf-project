/*
  # Fix encryption setup and dependencies

  1. Changes
    - Drop objects in correct order (view first, then functions)
    - Recreate encryption functions and trigger
    - Set up proper permissions
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper function permissions
*/

-- First drop the view that depends on the functions
DROP VIEW IF EXISTS public.decrypted_chat_messages;

-- Now we can safely drop the functions and trigger
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON public.chat_messages;
DROP FUNCTION IF EXISTS public.encrypt_message_trigger();
DROP FUNCTION IF EXISTS public.encrypt_message(text, text);
DROP FUNCTION IF EXISTS public.decrypt_message(bytea, text, bytea);

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption function
CREATE OR REPLACE FUNCTION public.encrypt_message(
  message text,
  encryption_key text
)
RETURNS TABLE (
  encrypted_data bytea,
  iv bytea
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  initialization_vector bytea;
BEGIN
  -- Use pgcrypto's gen_random_bytes
  initialization_vector := public.gen_random_bytes(16);
  
  RETURN QUERY SELECT
    encrypt_iv(
      message::bytea,
      decode(encryption_key, 'hex'),
      initialization_vector,
      'aes'
    ) AS encrypted_data,
    initialization_vector AS iv;
END;
$$;

-- Create decryption function
CREATE OR REPLACE FUNCTION public.decrypt_message(
  encrypted_data bytea,
  encryption_key text,
  iv bytea
)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN convert_from(
    decrypt_iv(
      encrypted_data,
      decode(encryption_key, 'hex'),
      iv,
      'aes'
    ),
    'utf8'
  );
END;
$$;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.encrypt_message_trigger()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  encryption_result record;
  encryption_key text;
BEGIN
  -- In production, this key should be stored securely and rotated regularly
  encryption_key := '0123456789abcdef0123456789abcdef';
  
  IF NEW.message IS NOT NULL THEN
    SELECT * INTO encryption_result 
    FROM public.encrypt_message(NEW.message, encryption_key);
    
    NEW.encrypted_message := encryption_result.encrypted_data;
    NEW.encryption_iv := encryption_result.iv;
    NEW.message := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_message_trigger();

-- Create view for decrypted messages
CREATE OR REPLACE VIEW public.decrypted_chat_messages AS
SELECT 
  cm.id,
  cm.negotiation_id,
  cm.user_id,
  CASE 
    WHEN cm.encrypted_message IS NOT NULL THEN
      public.decrypt_message(
        cm.encrypted_message,
        '0123456789abcdef0123456789abcdef',
        cm.encryption_iv
      )
    ELSE
      cm.message
  END as message,
  cm.created_at
FROM public.chat_messages cm
WHERE EXISTS (
  SELECT 1 FROM negotiations n
  JOIN healthcare_claims c ON c.claim_id = n.claim_id
  WHERE n.id = cm.negotiation_id
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.encrypt_message TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_message TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_message_trigger TO postgres;
GRANT SELECT ON public.decrypted_chat_messages TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.encrypt_message(text, text) IS 'Encrypts a message using AES encryption with a random IV';
COMMENT ON FUNCTION public.decrypt_message(bytea, text, bytea) IS 'Decrypts an AES encrypted message using the provided key and IV';
COMMENT ON FUNCTION public.encrypt_message_trigger() IS 'Automatically encrypts messages before insertion';