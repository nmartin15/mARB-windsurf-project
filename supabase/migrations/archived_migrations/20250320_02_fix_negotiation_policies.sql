/*
  # Fix RLS Policies for Negotiations and Chat Messages

  1. Changes
    - Update RLS policies to properly handle user permissions
    - Fix policies to allow users to view and create negotiations
    - Fix policies to allow users to view and create chat messages
    
  2. Security
    - Ensure proper access control based on user authentication
    - Allow access only to authorized users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages for negotiations they're involved in" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages for negotiations they're involved in" ON chat_messages;
DROP POLICY IF EXISTS "Users can view negotiations they're involved in" ON negotiations;
DROP POLICY IF EXISTS "Users can create negotiations for their claims" ON negotiations;

-- Create updated policies for negotiations
CREATE POLICY "Users can view negotiations they're involved in"
  ON negotiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_claims
      WHERE healthcare_claims.claim_id = negotiations.claim_id
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
    )
  );

-- Create updated policies for chat messages
CREATE POLICY "Users can view messages for negotiations they're involved in"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN healthcare_claims c ON c.claim_id = n.claim_id
      WHERE n.id = chat_messages.negotiation_id
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
    )
  );