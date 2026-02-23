/*
  # Add foreign key relationship between claims and providers

  1. Changes
    - Add foreign key constraint from claims.provider_id to providers.id
    - Ensure provider_id in claims table references providers table
  
  2. Security
    - No changes to RLS policies
*/

-- Add foreign key constraint
ALTER TABLE claims
ADD CONSTRAINT claims_provider_id_fkey
FOREIGN KEY (provider_id) REFERENCES providers(id);