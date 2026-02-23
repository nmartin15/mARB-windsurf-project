/*
  # Add INSERT policy for healthcare_claims

  1. Changes
    - Add INSERT policy to allow authenticated users to insert claims
    
  2. Security
    - Allows authenticated users to insert healthcare claims data
*/

CREATE POLICY "Allow authenticated users to insert healthcare claims"
  ON healthcare_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
