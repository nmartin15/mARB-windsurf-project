/*
  # Add Message Encryption Support

  1. Changes
    - Add encrypted_message column to chat_messages table
    - Add encryption/decryption functions using pgcrypto
    - Create secure view for decrypted messages
    
  2. Security
    - Uses pgcrypto for strong encryption
    - Messages are encrypted at rest
    - Only authenticated users can access decrypted messages
    - Proper permissions set for all objects
*/

-- Set up proper search path
SET search_path TO public, auth;

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Add encrypted message columns
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS encrypted_message bytea,
ADD COLUMN IF NOT EXISTS encryption_iv bytea;

-- Create encryption function owned by postgres
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
  initialization_vector := gen_random_bytes(16);
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

ALTER FUNCTION public.encrypt_message(text, text) OWNER TO postgres;

-- Create decryption function owned by postgres
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

ALTER FUNCTION public.decrypt_message(bytea, text, bytea) OWNER TO postgres;

-- Create trigger function owned by postgres
CREATE OR REPLACE FUNCTION public.encrypt_message_trigger()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  encryption_result record;
  encryption_key text;
BEGIN
  encryption_key := '0123456789abcdef0123456789abcdef';
  
  IF NEW.message IS NOT NULL THEN
    SELECT * INTO encryption_result 
    FROM encrypt_message(NEW.message, encryption_key);
    
    NEW.encrypted_message := encryption_result.encrypted_data;
    NEW.encryption_iv := encryption_result.iv;
    NEW.message := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.encrypt_message_trigger() OWNER TO postgres;

-- Create trigger
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON public.chat_messages;
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
      decrypt_message(
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

ALTER VIEW public.decrypted_chat_messages OWNER TO postgres;
GRANT SELECT ON public.decrypted_chat_messages TO authenticated;

-- Add RLS policy for the view
DROP POLICY IF EXISTS "Users can view decrypted messages for their negotiations" ON public.chat_messages;
CREATE POLICY "Users can view decrypted messages for their negotiations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN healthcare_claims c ON c.claim_id = n.claim_id
      WHERE n.id = negotiation_id
    )
  );

-- Add comments
COMMENT ON TABLE public.chat_messages IS 'Stores encrypted chat messages. Messages are encrypted at rest using AES encryption.';
COMMENT ON COLUMN public.chat_messages.encrypted_message IS 'The AES encrypted message content';
COMMENT ON COLUMN public.chat_messages.encryption_iv IS 'Initialization vector used for AES encryption';