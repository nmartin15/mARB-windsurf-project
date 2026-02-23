# Migration Renaming Plan

This document outlines the plan to rename existing migrations to follow our new naming convention and better reflect their purpose in the application.

## New Naming Convention

```
YYYYMMDD_##_descriptive_name.sql
```

Where:
- `YYYYMMDD` is the date in ISO format (we'll preserve the original dates)
- `##` is a sequence number (01, 02, etc.) for migrations created on the same day
- `descriptive_name` is a clear, lowercase name with underscores that describes the purpose

## Renaming Map

| Current Filename | New Filename | Purpose |
|------------------|--------------|---------|
| 20250318080813_aged_voice.sql | 20250318_01_create_test_user.sql | Creates a test user for development purposes |
| 20250318130215_small_oasis.sql | 20250318_02_create_test_user_idempotent.sql | Creates a test user if not exists (improved version) |
| 20250318130326_broken_night.sql | 20250318_03_create_claims_alerts_tables.sql | Creates initial claims and alerts tables with RLS policies |
| 20250318131745_smooth_pond.sql | 20250318_04_fix_test_user_authentication.sql | Fixes test user authentication with provider_id |
| 20250318142318_flat_dune.sql | 20250318_05_add_claim_metadata.sql | Adds metadata fields to claims table |
| 20250318144201_morning_meadow.sql | 20250318_06_create_claim_history_table.sql | Creates claim history tracking table |
| 20250318144514_broken_valley.sql | 20250318_07_add_claim_attachments.sql | Adds attachment support for claims |
| 20250319062145_plain_unit.sql | 20250319_01_create_user_profiles.sql | Creates user profiles table with preferences |
| 20250320022751_golden_canyon.sql | 20250320_01_update_negotiations_schema.sql | Updates negotiations schema to use claim_id as varchar |
| 20250320023114_young_portal.sql | 20250320_02_fix_negotiation_policies.sql | Fixes RLS policies for negotiations and chat messages |
| 20250320023617_heavy_band.sql | 20250320_03_update_chat_message_policies.sql | Updates chat message policies for better security |
| 20250320023916_rough_sunset.sql | 20250320_04_add_negotiation_fields.sql | Adds additional fields to negotiations table |
| 20250320031324_yellow_rain.sql | 20250320_05_create_reporting_functions.sql | Creates reporting functions for claims analysis |
| 20250320070020_frosty_cottage.sql | 20250320_06_add_reporting_views.sql | Adds additional reporting views |
| 20250320070200_weathered_disk.sql | 20250320_07_fix_reporting_views.sql | Fixes issues with reporting views |
| 20250325125410_tender_hat.sql | 20250325_01_add_healthcare_claim_fields.sql | Adds additional fields to healthcare_claims |
| 20250326025030_throbbing_fountain.sql | 20250326_01_create_reporting_views.sql | Creates multiple reporting views for analytics |
| 20250326032445_jolly_fountain.sql | 20250326_02_add_performance_indexes.sql | Adds indexes for performance optimization |
| 20250326033241_mellow_shrine.sql | 20250326_03_add_financial_columns.sql | Adds computed columns for financial analysis |

## Implementation Plan

1. **Create a Migration Script**: 
   - Create a script that will rename all files according to the mapping above
   - Update any references in the codebase that might be using the old filenames

2. **Update Documentation**:
   - Update the README.md in the migrations directory to reflect the new names
   - Document the purpose of each migration clearly

3. **Testing**:
   - Ensure that the application still works correctly after the renaming
   - Verify that all database objects are still properly created

4. **Future Migrations**:
   - All new migrations should follow the new naming convention
   - Each migration should include a descriptive header comment explaining its purpose

## Note on Supabase Migrations

Since Supabase tracks which migrations have been run by filename, we need to be careful when renaming migrations that have already been applied to production or staging environments. The following approaches are possible:

1. **New Environment Setup**: For new environments, use the renamed migrations from the start
2. **Existing Environments**: Create a special migration that updates the migration tracking table to recognize the new filenames
3. **Documentation Only**: Keep the original filenames but update documentation to reflect their purpose

The recommended approach depends on your deployment strategy and current environment state.
