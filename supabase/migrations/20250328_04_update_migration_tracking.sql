/*
  # Update Migration Tracking for Renamed Files

  1. Changes
    - Updates the supabase_migrations.schema_migrations table to recognize the new migration filenames
    - Ensures that Supabase doesn't try to re-run migrations that have already been applied
    
  2. Security
    - No security implications, this is a metadata update only
*/

DO $$
BEGIN
    -- Update tracking for 20250320031324_yellow_rain.sql -> 20250320_05_create_reporting_functions.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_reporting_functions'
    WHERE name = 'yellow_rain';

    -- Update tracking for 20250320023916_rough_sunset.sql -> 20250320_04_add_negotiation_fields.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_negotiation_fields'
    WHERE name = 'rough_sunset';

    -- Update tracking for 20250326033241_mellow_shrine.sql -> 20250326_03_add_financial_columns.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_financial_columns'
    WHERE name = 'mellow_shrine';

    -- Update tracking for 20250320023114_young_portal.sql -> 20250320_02_fix_negotiation_policies.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'fix_negotiation_policies'
    WHERE name = 'young_portal';

    -- Update tracking for 20250326032445_jolly_fountain.sql -> 20250326_02_add_performance_indexes.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_performance_indexes'
    WHERE name = 'jolly_fountain';

    -- Update tracking for 20250318130215_small_oasis.sql -> 20250318_02_create_test_user_idempotent.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_test_user_idempotent'
    WHERE name = 'small_oasis';

    -- Update tracking for 20250318080813_aged_voice.sql -> 20250318_01_create_test_user.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_test_user'
    WHERE name = 'aged_voice';

    -- Update tracking for 20250318144514_broken_valley.sql -> 20250318_07_add_claim_attachments.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_claim_attachments'
    WHERE name = 'broken_valley';

    -- Update tracking for 20250325125410_tender_hat.sql -> 20250325_01_add_healthcare_claim_fields.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_healthcare_claim_fields'
    WHERE name = 'tender_hat';

    -- Update tracking for 20250320023617_heavy_band.sql -> 20250320_03_update_chat_message_policies.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'update_chat_message_policies'
    WHERE name = 'heavy_band';

    -- Update tracking for 20250318130326_broken_night.sql -> 20250318_03_create_claims_alerts_tables.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_claims_alerts_tables'
    WHERE name = 'broken_night';

    -- Update tracking for 20250320070020_frosty_cottage.sql -> 20250320_06_add_reporting_views.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_reporting_views'
    WHERE name = 'frosty_cottage';

    -- Update tracking for 20250320070200_weathered_disk.sql -> 20250320_07_fix_reporting_views.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'fix_reporting_views'
    WHERE name = 'weathered_disk';

    -- Update tracking for 20250320022751_golden_canyon.sql -> 20250320_01_update_negotiations_schema.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'update_negotiations_schema'
    WHERE name = 'golden_canyon';

    -- Update tracking for 20250318144201_morning_meadow.sql -> 20250318_06_create_claim_history_table.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_claim_history_table'
    WHERE name = 'morning_meadow';

    -- Update tracking for 20250318131745_smooth_pond.sql -> 20250318_04_fix_test_user_authentication.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'fix_test_user_authentication'
    WHERE name = 'smooth_pond';

    -- Update tracking for 20250318142318_flat_dune.sql -> 20250318_05_add_claim_metadata.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'add_claim_metadata'
    WHERE name = 'flat_dune';

    -- Update tracking for 20250326025030_throbbing_fountain.sql -> 20250326_01_create_reporting_views.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_reporting_views'
    WHERE name = 'throbbing_fountain';

    -- Update tracking for 20250319062145_plain_unit.sql -> 20250319_01_create_user_profiles.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'create_user_profiles'
    WHERE name = 'plain_unit';
    
    -- Update tracking for 20250318132141_falling_shrine.sql -> 20250318_08_rollback_initial_schema.sql
    UPDATE supabase_migrations.schema_migrations 
    SET name = 'rollback_initial_schema'
    WHERE name = 'falling_shrine';
END $$;

-- Add comment
COMMENT ON TABLE supabase_migrations.schema_migrations IS 'Tracks applied migrations with updated filenames';
