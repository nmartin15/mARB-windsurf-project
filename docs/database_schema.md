# Healthcare Claims Database Schema Documentation

## Overview

This document serves as the authoritative reference for the database schema used in the healthcare claims management system. All developers should refer to this document when creating new migrations, writing queries, or developing frontend components that interact with the database.

## Naming Conventions

To maintain consistency across the codebase, the following naming conventions should be followed:

1. **Column Names**: Use snake_case for all column names (e.g., `claim_filing_indicator_code`)
2. **Code vs. Description Columns**: For fields that have both a code and a description:
   - Code columns should end with `_code` (e.g., `claim_filing_indicator_code`)
   - Description columns should end with `_desc` (e.g., `claim_filing_indicator_desc`)
3. **Date Columns**: Use `_date` suffix for date columns (e.g., `service_date_start`)
4. **Amount Columns**: Use `_amount` suffix for monetary values (e.g., `billed_amount`)

## Table: healthcare_claims

The central table for storing healthcare claim information.

| Column Name                  | Data Type                | Description                                           | Example Value       |
| ---------------------------- | ------------------------ | ----------------------------------------------------- | ------------------- |
| id                           | integer                  | Primary key                                           | 1                   |
| claim_id                     | character varying(50)    | Unique identifier for the claim                       | 'CL-2025-001'       |
| total_claim_charge_amount    | numeric                  | Total amount charged for the claim                    | 1850.00             |
| facility_type_code           | character varying(10)    | Code identifying the facility type                    | '11'                |
| facility_type_desc           | character varying(100)   | Description of the facility type                      | 'Hospital'          |
| facility_code_qualifier      | character varying(10)    | Qualifier for the facility code                       | 'A'                 |
| facility_code_qualifier_desc | character varying(100)   | Description of the facility code qualifier            | 'National Provider' |
| claim_frequency_type_code    | character varying(10)    | Code for claim frequency type                         | '1'                 |
| claim_frequency_type_desc    | character varying(100)   | Description of claim frequency type                   | 'Original'          |
| service_date_start           | character varying(20)    | Start date of service                                 | '2025-03-15'        |
| service_date_end             | character varying(20)    | End date of service                                   | '2025-03-15'        |
| admission_type_code          | character varying(10)    | Code for admission type                               | '1'                 |
| admission_type_desc          | character varying(200)   | Description of admission type                         | 'Emergency'         |
| admission_source_code        | character varying(10)    | Code for admission source                             | '7'                 |
| admission_source_desc        | character varying(200)   | Description of admission source                       | 'Emergency Room'    |
| patient_status_code          | character varying(10)    | Code for patient status                               | '01'                |
| patient_status_desc          | character varying(200)   | Description of patient status                         | 'Discharged Home'   |
| claim_filing_indicator_code  | character varying(50)    | Code for claim filing indicator                       | 'MC'                |
| claim_filing_indicator_desc  | character varying(100)   | Description of claim filing indicator                 | 'Medicare'          |
| assignment_code              | character varying(50)    | Code for assignment                                   | 'Y'                 |
| assignment_desc              | character varying(200)   | Description of assignment                             | 'Yes'               |
| benefits_assignment          | character varying(50)    | Benefits assignment code                              | 'Y'                 |
| benefits_assignment_desc     | character varying(200)   | Description of benefits assignment                    | 'Yes'               |
| created_at                   | timestamp with time zone | Timestamp when record was created                     | '2025-03-15T12:00'  |
| updated_at                   | timestamp with time zone | Timestamp when record was last updated                | '2025-03-15T12:00'  |
| hospital_payment_date        | timestamp with time zone | Date when hospital received payment                   | '2025-03-20T12:00'  |
| claim_submission_date        | timestamp with time zone | Date when claim was submitted                         | '2025-03-16T12:00'  |
| days_to_hospital_payment     | integer                  | Days between service and payment                      | 5                   |
| days_to_claim_submission     | integer                  | Days between service and claim submission             | 1                   |
| total_processing_days        | integer                  | Total days for processing                             | 5                   |
| service_duration_days        | integer                  | Duration of service in days                           | 1                   |
| claim_age_days               | integer                  | Age of claim in days                                  | 13                  |
| patient_id                   | character varying(20)    | Patient identifier                                    | 'PT12345'           |
| provider_id                  | character varying(20)    | Provider identifier                                   | 'PR67890'           |
| payer_id                     | character varying(20)    | Payer identifier                                      | 'PY54321'           |
| diagnosis_code               | character varying(50)    | ICD-10 diagnosis code                                 | 'ICD10-E11.9'       |
| procedure_code               | character varying(50)    | CPT procedure code                                    | 'CPT99213'          |
| revenue_code                 | character varying(50)    | Revenue code                                          | 'REV450'            |
| place_of_service             | character varying(10)    | Place of service code                                 | '11'                |
| billing_provider_npi         | character varying(50)    | National Provider Identifier for billing provider     | '1234567890'        |
| attending_provider_npi       | character varying(50)    | National Provider Identifier for attending provider   | '0987654321'        |
| claim_status                 | character varying(50)    | Status of the claim                                   | 'Approved'          |
| denial_reason                | character varying(255)   | Reason for denial if claim was denied                 | 'Not covered'       |
| adjustment_reason_code       | character varying(50)    | Code for adjustment reason                            | 'ADJ01'             |
| billed_amount                | numeric                  | Amount billed                                         | 1850.00             |
| allowed_amount               | numeric                  | Amount allowed by payer                               | 1750.00             |
| paid_amount                  | numeric                  | Amount paid                                           | 1750.00             |
| patient_responsibility       | numeric                  | Amount patient is responsible for                     | 100.00              |
| billing_code                 | character varying(20)    | Administrative billing code for rural healthcare      | 'MEDOV-001'         |

## Common Claim Filing Indicator Codes

| Code | Description                |
| ---- | -------------------------- |
| MC   | Medicare                   |
| MA   | Medicare Part A            |
| MB   | Medicare Part B            |
| BL   | Blue Cross/Blue Shield     |
| CI   | Commercial Insurance       |
| CH   | CHAMPUS/TRICARE            |
| WC   | Workers' Compensation      |
| SP   | Self-Pay                   |
| MD   | Medicaid                   |
| VA   | Veterans Affairs           |
| TV   | Title V                    |
| OF   | Other Federal Program      |
| DS   | Disability                 |
| HM   | HMO                        |
| PP   | Personal Payment           |

## Best Practices for Schema Changes

1. **Always reference this document** before creating new migrations
2. **Update this document** when making schema changes
3. **Use the established naming conventions** for consistency
4. **Test migrations** in a staging environment before deploying to production
5. **Communicate schema changes** to the team

## Migration Checklist

When creating a new migration, ensure:

- [ ] Column names follow the established naming conventions
- [ ] Data types are consistent with existing schema
- [ ] Appropriate indexes are created for query performance
- [ ] This documentation is updated to reflect changes
- [ ] Frontend TypeScript interfaces are updated to match schema changes
