# PowerShell script to rename migration files according to our new naming convention
# This script should be run from the migrations directory

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

# Function to archive old migration files
function Archive-MigrationFiles {
    foreach ($oldName in $renamingMap.Keys) {
        if (Test-Path $oldName) {
            try {
                # Copy the file to archive directory
                Copy-Item -Path $oldName -Destination "$archiveDir\$oldName" -ErrorAction Stop
                "SUCCESS: Archived '$oldName' to '$archiveDir'" | Out-File -FilePath $logFile -Append
                Write-Host "Archived: $oldName -> $archiveDir" -ForegroundColor Green
            }
            catch {
                "ERROR: Failed to archive '$oldName'. Error: $_" | Out-File -FilePath $logFile -Append
                Write-Host "Error archiving $oldName. See log for details." -ForegroundColor Red
            }
        }
        else {
            "WARNING: File '$oldName' not found, skipping archive" | Out-File -FilePath $logFile -Append
            Write-Host "Warning: $oldName not found, skipping archive" -ForegroundColor Yellow
        }
    }
}

# Function to rename files
function Rename-MigrationFiles {
    foreach ($oldName in $renamingMap.Keys) {
        $newName = $renamingMap[$oldName]
        
        # Check if the old file exists
        if (Test-Path $oldName) {
            try {
                # Rename the file
                Rename-Item -Path $oldName -NewName $newName -ErrorAction Stop
                "SUCCESS: Renamed '$oldName' to '$newName'" | Out-File -FilePath $logFile -Append
                Write-Host "Renamed: $oldName -> $newName" -ForegroundColor Green
            }
            catch {
                "ERROR: Failed to rename '$oldName' to '$newName'. Error: $_" | Out-File -FilePath $logFile -Append
                Write-Host "Error renaming $oldName. See log for details." -ForegroundColor Red
            }
        }
        else {
            "WARNING: File '$oldName' not found, skipping" | Out-File -FilePath $logFile -Append
            Write-Host "Warning: $oldName not found, skipping" -ForegroundColor Yellow
        }
    }
}

# Function to update file content with new migration names
function Update-FileReferences {
    $files = Get-ChildItem -Path . -Filter "*.sql" -Recurse
    
    foreach ($file in $files) {
        $content = Get-Content -Path $file.FullName -Raw
        $modified = $false
        
        foreach ($oldName in $renamingMap.Keys) {
            if ($content -match [regex]::Escape($oldName)) {
                $content = $content -replace [regex]::Escape($oldName), $renamingMap[$oldName]
                $modified = $true
                "INFO: Updated reference to '$oldName' in file '$($file.Name)'" | Out-File -FilePath $logFile -Append
            }
        }
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content
            "SUCCESS: Updated references in '$($file.Name)'" | Out-File -FilePath $logFile -Append
            Write-Host "Updated references in: $($file.Name)" -ForegroundColor Cyan
        }
    }
}

# Function to remove old files from archive (only if they've been successfully renamed)
function Remove-ArchivedFiles {
    $confirmation = Read-Host "Are you sure you want to permanently delete the archived migration files? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "Operation cancelled. Archived files remain in $archiveDir" -ForegroundColor Yellow
        return
    }
    
    foreach ($oldName in $renamingMap.Keys) {
        $newName = $renamingMap[$oldName]
        
        # Only remove if the new file exists (indicating successful rename)
        if ((Test-Path $newName) -and (Test-Path "$archiveDir\$oldName")) {
            try {
                # Remove the archived file
                Remove-Item -Path "$archiveDir\$oldName" -ErrorAction Stop
                "SUCCESS: Removed archived file '$archiveDir\$oldName'" | Out-File -FilePath $logFile -Append
                Write-Host "Removed archived file: $archiveDir\$oldName" -ForegroundColor Green
            }
            catch {
                "ERROR: Failed to remove archived file '$archiveDir\$oldName'. Error: $_" | Out-File -FilePath $logFile -Append
                Write-Host "Error removing archived file. See log for details." -ForegroundColor Red
            }
        }
    }
    
    # Check if archive directory is empty and remove it if it is
    if ((Get-ChildItem -Path $archiveDir -Force | Measure-Object).Count -eq 0) {
        Remove-Item -Path $archiveDir -Force
        "SUCCESS: Removed empty archive directory '$archiveDir'" | Out-File -FilePath $logFile -Append
        Write-Host "Removed empty archive directory: $archiveDir" -ForegroundColor Green
    }
}

# Function to create a Supabase migration that updates the migration tracking table
function Create-MigrationTrackingUpdate {
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
}

# Main execution
function Show-Menu {
    Clear-Host
    Write-Host "===== Migration Renaming Tool =====" -ForegroundColor Cyan
    Write-Host "1: Archive old migration files (backup)"
    Write-Host "2: Rename migration files to new convention"
    Write-Host "3: Update references in other files"
    Write-Host "4: Create migration to update tracking table"
    Write-Host "5: Remove archived files (only after successful rename)"
    Write-Host "6: Run all steps (1-4)"
    Write-Host "Q: Quit"
    Write-Host "=================================" -ForegroundColor Cyan
}

# Main menu loop
do {
    Show-Menu
    $selection = Read-Host "Please make a selection"
    
    switch ($selection) {
        '1' {
            Write-Host "Archiving old migration files..." -ForegroundColor Blue
            "Step: Archiving old migration files..." | Out-File -FilePath $logFile -Append
            Archive-MigrationFiles
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        '2' {
            Write-Host "Renaming migration files..." -ForegroundColor Blue
            "Step: Renaming migration files..." | Out-File -FilePath $logFile -Append
            Rename-MigrationFiles
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        '3' {
            Write-Host "Updating references in other files..." -ForegroundColor Blue
            "Step: Updating references in other files..." | Out-File -FilePath $logFile -Append
            Update-FileReferences
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        '4' {
            Write-Host "Creating migration to update tracking table..." -ForegroundColor Blue
            "Step: Creating migration to update tracking table..." | Out-File -FilePath $logFile -Append
            Create-MigrationTrackingUpdate
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        '5' {
            Write-Host "Removing archived files..." -ForegroundColor Blue
            "Step: Removing archived files..." | Out-File -FilePath $logFile -Append
            Remove-ArchivedFiles
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        '6' {
            Write-Host "Running all steps..." -ForegroundColor Blue
            "Step: Running all steps..." | Out-File -FilePath $logFile -Append
            
            Write-Host "Step 1: Archiving old migration files..." -ForegroundColor Blue
            "Step 1: Archiving old migration files..." | Out-File -FilePath $logFile -Append
            Archive-MigrationFiles
            
            Write-Host "Step 2: Renaming migration files..." -ForegroundColor Blue
            "Step 2: Renaming migration files..." | Out-File -FilePath $logFile -Append
            Rename-MigrationFiles
            
            Write-Host "Step 3: Updating references in other files..." -ForegroundColor Blue
            "Step 3: Updating references in other files..." | Out-File -FilePath $logFile -Append
            Update-FileReferences
            
            Write-Host "Step 4: Creating migration to update tracking table..." -ForegroundColor Blue
            "Step 4: Creating migration to update tracking table..." | Out-File -FilePath $logFile -Append
            Create-MigrationTrackingUpdate
            
            Write-Host "All steps completed! See $logFile for details." -ForegroundColor Green
            "All steps completed!" | Out-File -FilePath $logFile -Append
            
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
} until ($selection -eq 'q')

Write-Host "Migration renaming tool closed. See $logFile for details." -ForegroundColor Green
