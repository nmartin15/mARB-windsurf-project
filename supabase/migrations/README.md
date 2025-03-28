# Supabase Migrations Registry

This document provides an organized overview of all Supabase migrations in the project, their purposes, and which application components use them.

## Core Table Migrations

| Migration File | Purpose | Used By | Status |
|----------------|---------|---------|--------|
| [20250327165230_create_healthcare_claims.sql](./20250327165230_create_healthcare_claims.sql) | Creates the main healthcare_claims table with all necessary columns, indexes, and sample data | ClaimsList.tsx, Dashboard.tsx | Active - Primary data table |

## View Migrations

| Migration File | Purpose | Used By | Status |
|----------------|---------|---------|--------|
| [20250327063000_revenue_leakage_view.sql](./20250327063000_revenue_leakage_view.sql) | Creates a view for revenue leakage analysis that aggregates data from healthcare_claims | RevenueLeak.tsx | Active - Supports Revenue Leakage Report |

## Function Migrations

| Migration File | Purpose | Used By | Status |
|----------------|---------|---------|--------|
| [20250327074100_trend_data_function.sql](./20250327074100_trend_data_function.sql) | Creates a function to calculate trend analysis data with different period options | TrendAnalysisChart.tsx (via Dashboard.tsx) | Active - Latest version |
| [20250327074000_payment_velocity_function.sql](./20250327074000_payment_velocity_function.sql) | Creates a function for payment velocity analysis | PaymentVelocityChart.tsx (via Dashboard.tsx) | Active - Latest version |
| [20250327063400_trend_analysis_function.sql](./20250327063400_trend_analysis_function.sql) | Earlier version of trend analysis function | None - Superseded | Deprecated |
| [20250327063300_payment_velocity_function.sql](./20250327063300_payment_velocity_function.sql) | Earlier version of payment velocity function | None - Superseded | Deprecated |
| [20250327063200_trend_analysis_function.sql](./20250327063200_trend_analysis_function.sql) | Earlier version of trend analysis function | None - Superseded | Deprecated |
| [20250327063100_payment_velocity_function.sql](./20250327063100_payment_velocity_function.sql) | Earlier version of payment velocity function | None - Superseded | Deprecated |

## Legacy/Unknown Migrations

These migrations have unclear naming conventions and may be deprecated or experimental. They require further investigation:

| Migration File | Status | Notes |
|----------------|--------|-------|
| 20250318080813_aged_voice.sql | Unknown | Requires investigation |
| 20250318130215_small_oasis.sql | Unknown | Requires investigation |
| 20250318130326_broken_night.sql | Unknown | Requires investigation |
| 20250318131745_smooth_pond.sql | Unknown | Requires investigation |
| 20250318132141_falling_shrine.sql | Unknown | Requires investigation |
| 20250318142318_flat_dune.sql | Unknown | Requires investigation |
| 20250318144201_morning_meadow.sql | Unknown | Requires investigation |
| 20250318144514_broken_valley.sql | Unknown | Requires investigation |
| 20250319062145_plain_unit.sql | Unknown | Requires investigation |
| 20250320022751_golden_canyon.sql | Unknown | Requires investigation |
| 20250320023114_young_portal.sql | Unknown | Requires investigation |
| 20250320023617_heavy_band.sql | Unknown | Requires investigation |
| 20250320023916_rough_sunset.sql | Unknown | Requires investigation |
| 20250320031324_yellow_rain.sql | Unknown | Requires investigation |
| 20250320070020_frosty_cottage.sql | Unknown | Requires investigation |
| 20250320070200_weathered_disk.sql | Unknown | Requires investigation |
| 20250325125410_tender_hat.sql | Unknown | Requires investigation |
| 20250326025030_throbbing_fountain.sql | Unknown | Requires investigation |
| 20250326032445_jolly_fountain.sql | Unknown | Requires investigation |
| 20250326033241_mellow_shrine.sql | Unknown | Requires investigation |

## Migration Naming Convention

Going forward, all new migrations should follow this naming convention:

```
YYYYMMDD_##_descriptive_name.sql
```

Where:
- `YYYYMMDD` is the date in ISO format
- `##` is a sequence number (01, 02, etc.) for migrations created on the same day
- `descriptive_name` is a clear, lowercase name with underscores that describes the purpose

Example: `20250328_01_add_patient_demographics_table.sql`

## Migration Best Practices

1. **Documentation**: Each migration should include a comment header with:
   - Purpose of the migration
   - Components that use the objects created/modified
   - Any dependencies on other migrations

2. **Idempotency**: Migrations should be idempotent (can be run multiple times without error)
   - Use `CREATE OR REPLACE` for views and functions
   - Use `IF NOT EXISTS` for tables and indexes

3. **Rollback**: Include rollback statements as comments at the end of the migration

4. **Security**: Include appropriate permissions for each object created