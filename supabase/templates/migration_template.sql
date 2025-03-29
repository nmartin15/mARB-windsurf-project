/*
  # [Title of Migration]

  1. Changes
    - [Brief description of change 1]
    - [Brief description of change 2]
    - [Brief description of change 3]
    
  2. Security
    - [Security implications, if any]
*/

-- [Section 1: Schema Changes]
-- Example: Add new columns
ALTER TABLE [table_name] 
ADD COLUMN IF NOT EXISTS [column_name]_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS [column_name]_desc VARCHAR(200);

-- Example: Create a new table
CREATE TABLE IF NOT EXISTS [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  [column_name]_code VARCHAR(50) NOT NULL,
  [column_name]_desc VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- [Section 2: Indexes]
-- Example: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_[table_name]_[column_name]_code 
ON [table_name]([column_name]_code);

-- [Section 3: Data Updates]
-- Example: Update existing records
UPDATE [table_name]
SET [column_name]_code = 'DEFAULT'
WHERE [column_name]_code IS NULL;

-- [Section 4: Comments]
-- Example: Add comments to explain columns
COMMENT ON COLUMN [table_name].[column_name]_code IS 'Brief description of the column';
COMMENT ON COLUMN [table_name].[column_name]_desc IS 'Description of the code meaning';

-- [Section 5: Permissions]
-- Example: Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON [table_name] TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE [table_name]_id_seq TO authenticated;
