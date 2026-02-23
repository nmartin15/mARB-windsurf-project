# Migrations to Archive/Remove

This document lists migrations that should be archived because they contain synthetic data or structures inconsistent with real EDI 837/835 data.

## Migrations with Synthetic/Sample Data

These migrations insert sample data that doesn't match real EDI format:

### High Priority - Remove Sample Data
1. **20250327165230_create_healthcare_claims.sql**
   - Issues: Uses UUID for provider_id, payer_id, patient_id (should be VARCHAR)
   - Issues: Inserts 12 sample claims with UUID IDs
   - Action: Data will be cleaned by 20250115_08, but migration should be archived

2. **20250326070000_realistic_837_835_data.sql**
   - Issues: Inserts 150 synthetic claims
   - Issues: Uses INTEGER for IDs instead of VARCHAR
   - Action: Data will be cleaned by 20250115_08, but migration should be archived

3. **20250328_08_populate_missing_fields.sql**
   - Issues: Populates NULL fields with synthetic/random data
   - Issues: Generates fake provider IDs, payer IDs, dates, amounts
   - Action: Migration should be archived - real EDI data will have all required fields

4. **20250326_03_add_financial_columns.sql**
   - Issues: Inserts 5 sample claims with INTEGER IDs
   - Action: Data will be cleaned, but migration should be reviewed

## Migrations with Inconsistent Schema

These migrations create structures that don't match real EDI data:

1. **20250319062145_plain_unit.sql**
   - Issues: Creates healthcare_claims with INTEGER id (should be UUID or keep as is)
   - Issues: Uses VARCHAR for service_date_start/end (inconsistent)
   - Status: May be superseded by later migrations

2. **20250319_01_create_user_profiles.sql**
   - Issues: Creates healthcare_claims with INTEGER id
   - Status: May be superseded

## Migrations to Keep (Real EDI Compatible)

These migrations are compatible with real EDI data structure:

1. **20250325_01_add_healthcare_claim_fields.sql** ✅
   - Adds VARCHAR(20) for provider_id, payer_id, patient_id
   - Adds financial columns
   - Compatible with real EDI

2. **20250325125410_tender_hat.sql** ✅
   - Same as above, adds VARCHAR fields
   - Compatible with real EDI

3. **20250327063000_revenue_leakage_view.sql** ✅
   - Creates view for revenue analysis
   - Works with real data structure

4. **20250328_07_add_billing_code_to_claims.sql** ✅
   - Adds billing_code field
   - Compatible with real EDI

5. **20250115_01 through 20250115_07** ✅
   - New normalized tables for real EDI structure
   - All use VARCHAR for IDs

## Recommended Actions

1. **Archive these migrations** (move to archived_migrations folder):
   - 20250327165230_create_healthcare_claims.sql
   - 20250326070000_realistic_837_835_data.sql
   - 20250328_08_populate_missing_fields.sql
   - 20250326_03_add_financial_columns.sql (if it only has sample data)

2. **Keep but document**:
   - Early migrations that may have been superseded but don't break anything
   - Functions and views that work with real data structure

3. **Run cleanup migration**:
   - 20250115_08_cleanup_synthetic_data_and_fix_schema.sql will remove all synthetic data

## Notes

- The cleanup migration (20250115_08) will remove synthetic data but won't delete the migration files
- Migration files should be archived (not deleted) for historical reference
- New migrations (20250115_01-07) create the correct structure for real EDI data
- The revenue_leakage_view may need updating if it relies on aggregated data structure

