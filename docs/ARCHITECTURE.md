# mARB Health — Architecture

> Primary operational reference: `docs/837_JOURNEY_SPEC.md`  
> Parser/loader contract reference: `docs/EDI_PARSING_CONTRACT.md`

## System Overview

mARB Health is a Revenue Cycle Management (RCM) analytics platform that ingests EDI healthcare claim (837) and remittance (835) files, normalizes them into a relational schema, and presents actionable analytics through a React dashboard.

## Data Flow

```
Clearinghouse (Availity, Optum, WayStar, etc.)
        │
        ▼
    EDI File Upload (Web UI)
        │
        ├── 837P → parse_837p.py → claim_headers, claim_lines, claim_diagnoses,
        │                          claim_dates, claim_providers, claim_references
        │
        ├── 837I → parse_837i.py → (same tables, institutional fields populated)
        │
        └── 835  → parse_835.py  → claim_payments, claim_payment_lines,
                                    claim_adjustments
        │
        ▼
    load_to_supabase.py (upsert into normalized tables)
        │
        ▼
    Supabase PostgreSQL
        │
        ├── RPC Functions (get_payment_velocity, get_trend_data, etc.)
        │
        └── Direct queries from React frontend
        │
        ▼
    React Dashboard
```

## Database Schema

### Core Tables

| Table | Source | Description |
|-------|--------|-------------|
| `organizations` | Manual | Tenant table. Each practice/hospital is an org. |
| `claim_headers` | 837 CLM | One row per claim. Charge amounts, status, filing indicator. |
| `claim_lines` | 837 SV1/SV2 | Service line items. CPT codes (837P) or revenue codes (837I). |
| `claim_diagnoses` | 837 HI | ICD-10 diagnosis codes per claim. |
| `claim_dates` | 837 DTP | Date qualifiers (service date, admission, discharge, statement period). |
| `claim_providers` | 837 NM1/PRV | Billing, rendering, attending, referring providers per claim. |
| `claim_references` | 837 REF | Prior auth numbers, medical record numbers, tracking IDs. |
| `claim_payments` | 835 CLP | Payment records linked to claims. Payer, check, amount, date. |
| `claim_payment_lines` | 835 SVC | Line-level payment details. |
| `claim_adjustments` | 835 CAS | CARC/RARC denial and adjustment codes. |

### Reference Tables

| Table | Description |
|-------|-------------|
| `payer_directory` | Known payers with type classification. |
| `edi_file_log` | Tracks processed files to prevent duplicate ingestion. |
| `user_profiles` | User accounts linked to organizations. |

### Messaging Tables

| Table | Description |
|-------|-------------|
| `message_threads` | Dispute threads linked to claims. |
| `messages` | Encrypted messages within threads. |
| `message_attachments` | File attachments on messages. |
| `thread_participants` | Users with access to a thread. |
| `settlement_proposals` | Proposed settlement amounts. |
| `message_read_status` | Read receipts. |

### Future Tables

| Table | Description |
|-------|-------------|
| `prediction_history` | ML model prediction audit trail. |

## EDI-to-Database Mapping

### 837 CLM Segment → claim_headers

| EDI Field | Python Variable | DB Column |
|-----------|----------------|-----------|
| CLM01 | `clm_PatientControlNumber` | `claim_id` |
| CLM02 | `clm_TotalClaimChargeAmount` | `total_charge_amount` |
| CLM05-1 | `clm_FacilityTypeCode` | `facility_type_code` |
| CLM05-2 | `clm_FacilityCodeQualifier` | `facility_code_qualifier` |
| CLM05-3 | `clm_ClaimFrequencyTypeCode` | `claim_frequency_type_code` |
| CLM07 | `clm_AssignmentOrPlanParticipationCode` | `assignment_code` |
| CLM08 | `clm_BenefitsAssignmentCertificationIndicator` | `benefits_assignment` |
| SBR09 | `sbr_p_ClaimFilingIndicatorCode` | `claim_filing_indicator_code` |
| NM1*PR*03 | `nm1_pr_PayerName` | `payer_name` |
| NM1*PR*09 | `nm1_pr_PayerIdentifier` | `payer_id` |

### 837 SV1/SV2 Segment → claim_lines

| EDI Field | Python Variable | DB Column |
|-----------|----------------|-----------|
| LX01 | `clm_line_number` | `line_number` |
| SV2-01 | `lx_sv2_RevenueCode` | `revenue_code` |
| SV2-02 | `lx_sv2_ProcedureCode` | `procedure_code` |
| SV2-03 | `lx_sv2_LineItemChargeAmount` | `charge_amount` |
| SV2-04 | `lx_sv2_UnitBasisforMeasurementCode` | `unit_measurement_code` |
| SV2-05 | `lx_sv2_ServiceUnitCount` | `unit_count` |

### 837 HI Segment → claim_diagnoses

| EDI Field | DB Column |
|-----------|-----------|
| HI01-1 | `code_qualifier` (ABK=principal, ABF=other, etc.) |
| HI01-2 | `diagnosis_code` |

### 837 DTP Segment → claim_dates

| Qualifier | Description | DB `date_qualifier` |
|-----------|-------------|---------------------|
| 472 | Service Date | `472` |
| 232 | Statement Period Start | `232` |
| 233 | Statement Period End | `233` |
| 434 | Statement Dates | `434` |
| 435 | Admission Date | `435` |
| 096 | Discharge Date | `096` |
| 573 | Claim Paid Date | `573` |

### 835 CLP Segment → claim_payments

| EDI Field | DB Column |
|-----------|-----------|
| CLP01 | `patient_control_number` |
| CLP02 | `claim_status_code` |
| CLP03 | `total_charge_amount` |
| CLP04 | `paid_amount` |
| CLP05 | `patient_responsibility` |

### 835 CAS Segment → claim_adjustments

| EDI Field | DB Column |
|-----------|-----------|
| CAS01 | `adjustment_group_code` (CO, PR, OA, PI, CR) |
| CAS02 | `carc_code` |
| CAS03 | `adjustment_amount` |

## Frontend Components

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `Dashboard.tsx` | Main metrics, charts, recent claims |
| `/claims` | `ClaimsList.tsx` | Claims explorer with filtering and detail |
| `/reports` | `Reports.tsx` | Tab container for all report types |
| `/messages` | `MessageThreadsList.tsx` | Dispute message threads |
| `/messages/:id` | `ThreadView.tsx` | Individual thread view |
| `/notifications` | `Notifications.tsx` | System notifications |

### Reports

| Component | RPC Function | Description |
|-----------|-------------|-------------|
| `RevenueLeak.tsx` | Direct query | Claims where billed > paid or denied |
| `ARAgingReport.tsx` | `get_ar_aging` | A/R by payer in 30-day buckets |
| `DenialAnalysisReport.tsx` | `get_denial_summary` | Top CARC codes, denial by payer |
| `PayerPerformanceReport.tsx` | `get_payer_performance` | Speed, denial rate, reimbursement per payer |
| `CleanClaimRateReport.tsx` | `get_clean_claim_rate` | First-pass acceptance rate by month |

### Charts

| Component | Data Source | Visualization |
|-----------|-----------|---------------|
| `PaymentVelocityChart.tsx` | `get_payment_velocity` | Bar (disputes) + Line (days to payment) |
| `TrendAnalysisChart.tsx` | `get_trend_data` | Color-coded bar chart by aging bucket |
| `TrendChart.tsx` | `get_trend_data` | Historical trend bars |
| `FilingIndicatorChart.tsx` | `claim_headers` grouped | Bar chart by insurance type |

## Multi-Tenancy Strategy

Every data table includes an `org_id` foreign key to `organizations`. Current implementation filters in the application layer. Future: Row Level Security policies will enforce tenant isolation at the database level using `auth.uid()` → `user_profiles.org_id`.

## Security

- Row Level Security enabled on all tables
- Client-side encryption for messaging content (AES via CryptoJS)
- Supabase Auth for user authentication
- HIPAA-aware: PHI only in encrypted fields or behind RLS
