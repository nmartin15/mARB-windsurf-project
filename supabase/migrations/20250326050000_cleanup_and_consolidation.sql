/*
  # Database Cleanup and Consolidation Migration

  This migration addresses issues identified in the migration audit:
  1. Adds missing RLS policies for UPDATE and DELETE on healthcare_claims
  2. Removes duplicate/conflict sample data from early migrations
  3. Ensures consistent sample data (keeps mellow_shrine data)
  4. Adds helpful comments for future maintenance
  
  Security:
  - Adds complete RLS policy coverage for healthcare_claims
  - Maintains authentication requirements
*/

-- ============================================================================
-- PART 1: Add Missing RLS Policies
-- ============================================================================

-- Add UPDATE policy for healthcare_claims
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'healthcare_claims' 
    AND policyname = 'Allow authenticated users to update healthcare claims'
  ) THEN
    CREATE POLICY "Allow authenticated users to update healthcare claims"
      ON healthcare_claims
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add DELETE policy for healthcare_claims  
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'healthcare_claims' 
    AND policyname = 'Allow authenticated users to delete healthcare claims'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete healthcare claims"
      ON healthcare_claims
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- PART 2: Clean Up Duplicate Sample Data
-- ============================================================================

-- Remove early test claims (from weathered_disk migration)
-- These conflict with the better structured data in mellow_shrine
DELETE FROM healthcare_claims
WHERE claim_id IN ('316514501', '316514502', '316514503', '316514504', '316514505')
AND created_at < NOW() - INTERVAL '5 days';

-- Remove related notifications for deleted claims
DELETE FROM notifications
WHERE claim_id IN ('316514501', '316514502', '316514503', '316514504', '316514505');

-- ============================================================================
-- PART 3: Add Table Comments for Documentation
-- ============================================================================

COMMENT ON TABLE healthcare_claims IS 'Primary table for healthcare claims data. Contains financial, clinical, and administrative information for claims processing and analysis.';

COMMENT ON COLUMN healthcare_claims.claim_id IS 'Unique identifier for the claim (e.g., CLM2024001)';
COMMENT ON COLUMN healthcare_claims.total_claim_charge_amount IS 'Total amount charged for the claim';
COMMENT ON COLUMN healthcare_claims.billed_amount IS 'Amount billed to payer';
COMMENT ON COLUMN healthcare_claims.paid_amount IS 'Amount actually paid by payer';
COMMENT ON COLUMN healthcare_claims.claim_status IS 'Current status: paid, denied, pending, etc.';
COMMENT ON COLUMN healthcare_claims.claim_filing_indicator_desc IS 'Insurance type: Commercial, Medicare, Medicaid, etc.';

-- ============================================================================
-- PART 4: Add Helpful Indexes (if not exists)
-- ============================================================================

-- Composite index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_hc_status_filing_date 
ON healthcare_claims(claim_status, claim_filing_indicator_desc, created_at);

-- Index for amount-based queries
CREATE INDEX IF NOT EXISTS idx_hc_amounts
ON healthcare_claims(total_claim_charge_amount, billed_amount, paid_amount);

-- ============================================================================
-- PART 5: Update Statistics
-- ============================================================================

-- Analyze the table to update query planner statistics
ANALYZE healthcare_claims;

-- ============================================================================
-- Verification Queries (commented out - for reference)
-- ============================================================================

-- Uncomment to verify RLS policies:
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'healthcare_claims';

-- Uncomment to verify sample data:
-- SELECT claim_id, total_claim_charge_amount, claim_filing_indicator_desc, created_at
-- FROM healthcare_claims
-- ORDER BY created_at DESC;

-- Uncomment to verify indexes:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'healthcare_claims';
