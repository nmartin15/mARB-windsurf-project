# Simple PowerShell script to rename migration files

# Define the renaming map
$renamingMap = @{
    "20250318080813_aged_voice.sql" = "20250318_01_create_test_user.sql"
    "20250318130215_small_oasis.sql" = "20250318_02_create_test_user_idempotent.sql"
    "20250318130326_broken_night.sql" = "20250318_03_create_claims_alerts_tables.sql"
    "20250318131745_smooth_pond.sql" = "20250318_04_fix_test_user_authentication.sql"
    "20250318142318_flat_dune.sql" = "20250318_05_add_claim_metadata.sql"
    "20250318144201_morning_meadow.sql" = "20250318_06_create_claim_history_table.sql"
    "20250318144514_broken_valley.sql" = "20250318_07_add_claim_attachments.sql"
    "20250319062145_plain_unit.sql" = "20250319_01_create_user_profiles.sql"
    "20250320022751_golden_canyon.sql" = "20250320_01_update_negotiations_schema.sql"
    "20250320023114_young_portal.sql" = "20250320_02_fix_negotiation_policies.sql"
    "20250320023617_heavy_band.sql" = "20250320_03_update_chat_message_policies.sql"
    "20250320023916_rough_sunset.sql" = "20250320_04_add_negotiation_fields.sql"
    "20250320031324_yellow_rain.sql" = "20250320_05_create_reporting_functions.sql"
    "20250320070020_frosty_cottage.sql" = "20250320_06_add_reporting_views.sql"
    "20250320070200_weathered_disk.sql" = "20250320_07_fix_reporting_views.sql"
    "20250325125410_tender_hat.sql" = "20250325_01_add_healthcare_claim_fields.sql"
    "20250326025030_throbbing_fountain.sql" = "20250326_01_create_reporting_views.sql"
    "20250326032445_jolly_fountain.sql" = "20250326_02_add_performance_indexes.sql"
    "20250326033241_mellow_shrine.sql" = "20250326_03_add_financial_columns.sql"
}

# Create a log file
$logFile = "migration_rename_log.txt"
"Migration Renaming Log - $(Get-Date)" | Out-File -FilePath $logFile

# Create archive directory
$archiveDir = "archived_migrations"
if (-not (Test-Path $archiveDir)) {
    New-Item -Path $archiveDir -ItemType Directory | Out-Null
    "Created archive directory: $archiveDir" | Out-File -FilePath $logFile -Append
    Write-Host "Created archive directory: $archiveDir" -ForegroundColor Blue
}

# Simple function to archive and rename files
foreach ($oldName in $renamingMap.Keys) {
    $newName = $renamingMap[$oldName]
    
    # Check if the old file exists
    if (Test-Path $oldName) {
        # First, copy to archive
        try {
            Copy-Item -Path $oldName -Destination "$archiveDir\$oldName" -ErrorAction Stop
            "SUCCESS: Archived '$oldName' to '$archiveDir'" | Out-File -FilePath $logFile -Append
            Write-Host "Archived: $oldName -> $archiveDir" -ForegroundColor Green
            
            # Then rename
            Rename-Item -Path $oldName -NewName $newName -ErrorAction Stop
            "SUCCESS: Renamed '$oldName' to '$newName'" | Out-File -FilePath $logFile -Append
            Write-Host "Renamed: $oldName -> $newName" -ForegroundColor Green
        }
        catch {
            "ERROR: Failed operation on '$oldName'. Error: $_" | Out-File -FilePath $logFile -Append
            Write-Host "Error processing $oldName. See log for details." -ForegroundColor Red
        }
    }
    else {
        "WARNING: File '$oldName' not found, skipping" | Out-File -FilePath $logFile -Append
        Write-Host "Warning: $oldName not found, skipping" -ForegroundColor Yellow
    }
}

# Create migration to update tracking table
$migrationContent = @"
/*
  # Update Migration Tracking for Renamed Files

  1. Changes
    - Updates the schema_migrations table to recognize the new migration filenames
    - Ensures that Supabase doesn't try to re-run migrations that have already been applied
    
  2. Security
    - No security implications, this is a metadata update only
*/

DO \$\$
BEGIN
"@

foreach ($oldName in $renamingMap.Keys) {
    $newName = $renamingMap[$oldName]
    $migrationContent += @"

    -- Update tracking for $oldName -> $newName
    UPDATE _schema_migrations 
    SET name = '$newName'
    WHERE name = '$oldName';
"@
}

$migrationContent += @"

END \$\$;

-- Add comment
COMMENT ON TABLE _schema_migrations IS 'Tracks applied migrations with updated filenames';
"@

$migrationFile = "20250328_04_update_migration_tracking.sql"
Set-Content -Path $migrationFile -Value $migrationContent
"SUCCESS: Created migration tracking update file '$migrationFile'" | Out-File -FilePath $logFile -Append
Write-Host "Created migration tracking update file: $migrationFile" -ForegroundColor Green

Write-Host "Migration renaming complete! See $logFile for details." -ForegroundColor Green
"Migration renaming complete!" | Out-File -FilePath $logFile -Append
