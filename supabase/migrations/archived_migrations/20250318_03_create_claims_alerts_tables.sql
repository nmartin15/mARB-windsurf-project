/*
  # Healthcare Claims Platform Schema

  1. New Tables
    - claims
      - id (uuid, primary key)
      - amount (numeric, not null)
      - status (enum: open, closed, in_negotiation)
      - provider (text, not null)
      - created_at (timestamptz)
      - updated_at (timestamptz)
      - user_id (uuid, foreign key to auth.users)
    
    - alerts
      - id (uuid, primary key)
      - claim_id (uuid, foreign key to claims)
      - message (text, not null)
      - severity (enum: low, medium, high)
      - created_at (timestamptz)
      - user_id (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to:
      - Read their own claims and alerts
      - Create new claims and alerts
      - Update their own claims
      - Delete their own alerts
*/

-- Create custom types
CREATE TYPE claim_status AS ENUM ('open', 'closed', 'in_negotiation');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  status claim_status NOT NULL DEFAULT 'open',
  provider text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES claims(id) ON DELETE CASCADE,
  message text NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'low',
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Claims policies
CREATE POLICY "Users can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alerts policies
CREATE POLICY "Users can view their own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to claims
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for the test user
DO $$
DECLARE
  test_user_id uuid;
  claim_id uuid;
BEGIN
  -- Get the test user's ID
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test@healthcare.com' LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Insert sample claims
    INSERT INTO claims (amount, status, provider, user_id) VALUES
      (25000, 'open', 'Aetna', test_user_id) RETURNING id INTO claim_id;
    
    -- Insert sample alerts for the claim
    INSERT INTO alerts (claim_id, message, severity, user_id) VALUES
      (claim_id, 'Claim requires additional documentation', 'medium', test_user_id);
      
    INSERT INTO claims (amount, status, provider, user_id) VALUES
      (15000, 'in_negotiation', 'Cigna', test_user_id) RETURNING id INTO claim_id;
      
    INSERT INTO alerts (claim_id, message, severity, user_id) VALUES
      (claim_id, 'Negotiation in progress', 'low', test_user_id);
  END IF;
END $$;