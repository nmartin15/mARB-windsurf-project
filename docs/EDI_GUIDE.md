# EDI Reference Guide

Quick reference for the EDI transaction types used by mARB Health.

## Transaction Types

| Type | Form | Use | Segments |
|------|------|-----|----------|
| **837P** | CMS-1500 | Professional claims (physician/clinic) | CLM, SV1, HI, DTP, NM1, SBR, REF |
| **837I** | UB-04 | Institutional claims (hospital) | CLM, SV2, HI, DTP, NM1, SBR, CL1, REF |
| **835** | N/A | Remittance advice (payment/denial) | CLP, SVC, CAS, DTM, PLB |

## 837P vs 837I Key Differences

| Aspect | 837P (Professional) | 837I (Institutional) |
|--------|--------------------|--------------------|
| Service lines | SV1 segment | SV2 segment |
| Procedure codes | CPT/HCPCS | Revenue codes + optional HCPCS |
| Place of service | In SV1 (POS code) | In CLM05 (facility type) |
| Admission data | N/A | CL1 segment (type, source, status) |
| DRG | N/A | HI segment with BG/DR qualifier |
| Modifiers | Up to 4 in SV1 | In SV2 procedure identifier |

## Key 837 Segments

### CLM — Claim Header
```
CLM*PatientControlNumber*TotalCharge***FacilityType>CodeQualifier>FrequencyType
    **AssignmentCode*BenefitsAssignment*ReleaseOfInfo~
```

### SV1 — Professional Service Line (837P)
```
SV1*HC>CPTCode>Modifier1>Modifier2*ChargeAmount*UN*Units*PlaceOfService~
```

### SV2 — Institutional Service Line (837I)
```
SV2*RevenueCode*HC>ProcedureCode*ChargeAmount*UnitCode*Units~
```

### HI — Diagnosis Information
```
HI*ABK>ICD10Code*ABF>ICD10Code2~
```
Qualifiers: ABK=Principal, ABF=Other, BBR=Admitting, APR=Reason for Visit

### DTP — Date/Time Reference
```
DTP*Qualifier*D8*CCYYMMDD~
DTP*Qualifier*RD8*CCYYMMDD-CCYYMMDD~
```
Common qualifiers:
- 472 = Service Date
- 232 = Statement Period Start
- 233 = Statement Period End
- 434 = Statement Dates
- 435 = Admission Date
- 096 = Discharge Date
- 573 = Claim Paid Date

### NM1 — Entity Name
```
NM1*EntityCode*EntityType*Last*First*Middle**Suffix*IDQualifier*ID~
```
Entity codes: 85=Billing Provider, 71=Attending, 82=Rendering, PR=Payer

### SBR — Subscriber Information
```
SBR*ResponsibilitySeq*RelationshipCode*******FilingIndicatorCode~
```
Responsibility: P=Primary, S=Secondary, T=Tertiary

### CL1 — Institutional Claim Code (837I only)
```
CL1*AdmissionType*AdmissionSource*PatientStatus~
```

## Key 835 Segments

### CLP — Claim Payment
```
CLP*PatientControlNumber*StatusCode*ChargedAmount*PaidAmount*PatientResponsibility
    *FilingIndicator~
```
Status codes: 1=Processed Primary, 2=Processed Secondary, 3=Processed Tertiary, 4=Denied, 22=Reversal

### SVC — Service Payment
```
SVC*HC>CPTCode*ChargeAmount*PaidAmount**Units~
```

### CAS — Claim Adjustment
```
CAS*GroupCode*ReasonCode*Amount*Quantity~
```
Group codes:
- **CO** — Contractual Obligation (provider write-off)
- **PR** — Patient Responsibility (deductible, copay, coinsurance)
- **OA** — Other Adjustment
- **PI** — Payer Initiated Reduction
- **CR** — Correction/Reversal

### DTM — Date/Time (835)
```
DTM*Qualifier*CCYYMMDD~
```

### PLB — Provider Level Balance
```
PLB*ProviderID*FiscalPeriodDate*AdjustmentCode*Amount~
```

## CARC Codes (Common)

| Code | Description |
|------|-------------|
| 1 | Deductible Amount |
| 2 | Coinsurance Amount |
| 3 | Copayment Amount |
| 4 | The procedure code is inconsistent with the modifier |
| 16 | Claim/service lacks information needed for adjudication |
| 18 | Exact duplicate claim/service |
| 22 | This care may be covered by another payer |
| 23 | Payment adjusted — charges included in allowance for another service |
| 29 | The time limit for filing has expired |
| 45 | Charges exceed your contracted/legislated fee arrangement |
| 50 | Not covered — non-covered services |
| 96 | Non-covered charge(s) |
| 97 | Benefit for this service not included in current contract/plan |
| 204 | Service not covered/not authorized |
| 242 | Services not provided/authorized by designated provider |
| 252 | Service not on the approved list |

## Filing Indicator Codes (SBR09)

| Code | Description |
|------|-------------|
| MA | Medicare Part A |
| MB | Medicare Part B |
| MC | Medicaid |
| BL | Blue Cross/Blue Shield |
| CI | Commercial Insurance |
| HM | Health Maintenance Organization |
| 12 | PPO |
| 13 | POS |
| 14 | EPO |
| 15 | Indemnity |
| WC | Workers Compensation |
| CH | CHAMPUS/TRICARE |
| VA | Veterans Affairs |

## Date Formats

- **D8**: Single date — `CCYYMMDD` (e.g., `20250115` = January 15, 2025)
- **RD8**: Date range — `CCYYMMDD-CCYYMMDD` (e.g., `20250115-20250120`)

Parse logic: `SUBSTRING(date_str, 1, 4) || '-' || SUBSTRING(date_str, 5, 2) || '-' || SUBSTRING(date_str, 7, 2)`
