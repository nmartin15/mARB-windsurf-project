/*
  # Add Negotiations and Chat Features

  1. New Tables
    - `negotiations`
      - `id` (uuid, primary key)
      - `claim_id` (uuid, foreign key to claims)
      - `status` (enum: pending, accepted, rejected)
      - `proposed_amount` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid, foreign key to auth.users)

    - `chat_messages`
      - `id` (uuid, primary key)
      - `negotiation_id` (uuid, foreign key to negotiations)
      - `user_id` (uuid, foreign key to auth.users)
      - `message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create negotiations status enum
CREATE TYPE negotiation_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create negotiations table
CREATE TABLE IF NOT EXISTS negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES claims(id) NOT NULL,
  status negotiation_status NOT NULL DEFAULT 'pending',
  proposed_amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  CONSTRAINT valid_proposed_amount CHECK (proposed_amount > 0)
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid REFERENCES negotiations(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for negotiations
CREATE POLICY "Users can view negotiations they're involved in"
  ON negotiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      WHERE claims.id = negotiations.claim_id
      AND claims.user_id = auth.uid()
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
      SELECT 1 FROM claims
      WHERE claims.id = claim_id
      AND claims.user_id = auth.uid()
    ) OR
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE auth.email() LIKE '%@insurance.com'
    )
  );

-- Policies for chat messages
CREATE POLICY "Users can view messages for negotiations they're involved in"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN claims c ON c.id = n.claim_id
      WHERE n.id = chat_messages.negotiation_id
      AND (c.user_id = auth.uid() OR
           auth.uid() IN (
             SELECT id FROM auth.users
             WHERE auth.email() LIKE '%@insurance.com'
           ))
    )
  );

CREATE POLICY "Users can create messages for negotiations they're involved in"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM negotiations n
      JOIN claims c ON c.id = n.claim_id
      WHERE n.id = negotiation_id
      AND (c.user_id = auth.uid() OR
           auth.uid() IN (
             SELECT id FROM auth.users
             WHERE auth.email() LIKE '%@insurance.com'
           ))
    )
  );

-- Add updated_at trigger for negotiations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_negotiations_updated_at
  BEFORE UPDATE ON negotiations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_negotiations_claim_id ON negotiations(claim_id);
CREATE INDEX idx_chat_messages_negotiation_id ON chat_messages(negotiation_id);
CREATE INDEX idx_negotiations_created_by ON negotiations(created_by);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);