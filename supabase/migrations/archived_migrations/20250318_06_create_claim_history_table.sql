/*
  # Update Network Status Schema

  1. Changes
    - Remove existing is_out_of_network boolean column
    - Add network_status column with proper enum type
    - Add check constraint to ensure valid network status values
    - Migrate existing data
    - Update indexes and constraints

  2. Security
    - Maintain existing RLS policies
*/

-- Create enum type for network status
DO $$ BEGIN
  CREATE TYPE network_status AS ENUM ('INN', 'OON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add new network_status column
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS network_status network_status;

-- Migrate existing data
UPDATE claims
SET network_status = CASE 
  WHEN is_out_of_network = true THEN 'OON'::network_status
  ELSE 'INN'::network_status
END
WHERE network_status IS NULL;

-- Make network_status NOT NULL after data migration
ALTER TABLE claims
ALTER COLUMN network_status SET NOT NULL;

-- Drop old column
ALTER TABLE claims
DROP COLUMN IF EXISTS is_out_of_network;

-- Add index for network_status
CREATE INDEX IF NOT EXISTS idx_claims_network_status
ON claims(network_status);

-- Update existing claims view if exists
CREATE OR REPLACE VIEW claims_summary AS
SELECT 
  c.*,
  p.name as provider_name,
  network_status as network_code
FROM claims c
LEFT JOIN providers p ON c.provider_id = p.id;

COMMENT ON COLUMN claims.network_status IS 'Network status of the claim (INN: In Network, OON: Out of Network)';