/*
  # Update Negotiations Schema for Claim ID

  1. Changes
    - Drop all dependent policies first (chat_messages and negotiations)
    - Modify negotiations table to use claim_id as varchar
    - Update chat_messages policies to use the new column type
    - Recreate all policies with updated column references
    - Add appropriate indexes
    
  2. Security
    - Recreate RLS policies with updated column references
    - Maintain same security rules with new column type
*/

-- First drop all dependent policies to avoid dependency issues
DROP POLICY IF EXISTS "Users can view messages for negotiations they're involved in" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages for negotiations they're involved in" ON chat_messages;
DROP POLICY IF EXISTS "Users can view negotiations they're involved in" ON negotiations;
DROP POLICY IF EXISTS "Users can create negotiations for their claims" ON negotiations;

-- Drop existing foreign key and index
ALTER TABLE negotiations
DROP CONSTRAINT IF EXISTS negotiations_claim_id_fkey;
DROP INDEX IF EXISTS idx_negotiations_claim_id;

-- Change the column type
ALTER TABLE negotiations
ALTER COLUMN claim_id TYPE varchar USING claim_id::text;

-- Add index for the new column type
CREATE INDEX idx_negotiations_claim_id ON negotiations(claim_id);

-- Recreate the negotiations policies with the new column type
CREATE POLICY "Users can view negotiations they're involved in"
  ON negotiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_claims
      WHERE healthcare_claims.claim_id = negotiations.claim_id
    ) OR
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE auth.email() LIKE '%@insurance.com'
    )
  );

CREATE POLICY "Users can create negotiations for their claims"
  ON negotiations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM healthcare_claims
      WHERE healthcare_claims.claim_id = claim_id
    ) OR
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE auth.email() LIKE '%@insurance.com'
    )
  );

-- Recreate the chat_messages policies
CREATE POLICY "Users can view messages for negotiations they're involved in"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN healthcare_claims c ON c.claim_id = n.claim_id
      WHERE n.id = chat_messages.negotiation_id
      AND (
        auth.uid() IN (
          SELECT id FROM auth.users
          WHERE auth.email() LIKE '%@insurance.com'
        )
      )
    )
  );

CREATE POLICY "Users can create messages for negotiations they're involved in"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN healthcare_claims c ON c.claim_id = n.claim_id
      WHERE n.id = negotiation_id
      AND (
        auth.uid() IN (
          SELECT id FROM auth.users
          WHERE auth.email() LIKE '%@insurance.com'
        )
      )
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN negotiations.claim_id IS 'References healthcare_claims.claim_id';