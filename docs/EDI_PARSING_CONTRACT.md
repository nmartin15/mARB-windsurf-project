# EDI Parsing Contract v1 (Dynamic, No Breaks)

Purpose: keep ingestion stable on day one while allowing rapid expansion to broader 837/835 variants without parser rewrites.

## 1) Non-Negotiable Principles

- Never fail an entire file because of unknown codes or optional segment variance.
- Fail only on structural corruption (cannot determine segment stream safely).
- Parse first, classify second: ingest raw values even when code meaning is unknown.
- Preserve traceability: every normalized record must be traceable to raw segment context.
- Deterministic output shape: required canonical fields are always present (nullable where needed).

## 2) Scope

- Primary transaction support: 837P claims + 835 remittance.
- 837I and edge payer-specific variants are accepted as "best effort" under flex rules until promoted to canonical.

## 3) Canonical Core (Must Not Break)

These fields are the minimal stable contract used by loaders, analytics, and dashboard logic.

### 3.1 837 Claim Header Core

- `claim_id` (from `CLM01`)
- `file_name`, `file_type`, `file_hash`
- `total_charge_amount` (from `CLM02`)
- `claim_filing_indicator_code` (from `SBR09` when present)
- `payer_id`, `payer_name` (payer loop, typically `NM1*PR`)
- `claim_dates`:
  - service date (`DTP*472`)
  - statement start/end (`DTP*232` / `DTP*233`)
- `prior_auth_number` when present (`REF*G1`)

### 3.2 837 Service Line Core

- `line_number` (from `LX01`)
- `procedure_code` (from `SV1` composite)
- `modifier_1..modifier_4` when present
- `charge_amount` (from `SV102`)
- `unit_count` + `unit_measurement_code`
- `place_of_service_code`

### 3.3 837 Diagnosis Core

- `diagnosis_code` (from `HI` composites)
- `diagnosis_type` (qualifier mapped; unknown maps to `other`)
- `sequence_number`

### 3.4 835 Payment Core

- `patient_control_number` (from `CLP01`)
- `payer_claim_control_number` (from `CLP07`, required in parser output even if null)
- `claim_status_code` + mapped status description
- `total_charge_amount` (from `CLP03`)
- `paid_amount` (from `CLP04`)
- `patient_responsibility` (from `CLP05`)
- `check_number` (`TRN02` when present)
- `payment_date` (`DTM*573` preferred, then BPR date fallback)

### 3.5 835 Adjustment Core

- `adjustment_group_code` (CAS group)
- `carc_code`
- `adjustment_amount`
- `adjustment_quantity` (nullable)
- `level` (`claim` or `line`)

## 4) Flex Layer (Dynamic Extension)

All non-core, unknown, or payer-specific data is preserved in a flex payload:

- `raw_segment_id`
- `raw_elements` (array)
- `loop_context` (current transaction hierarchy context)
- `parse_warnings` (unknown qualifier, malformed composite, duplicate ambiguities)

Rules:

- Unknown qualifiers/codes must be retained in raw payload and warning logs.
- Unknown values must not block insertion of canonical core.
- Optional segments missing -> null canonical fields, not parser error.

## 5) Delimiter and Structure Policy

- Detect delimiters from ISA envelope (element separator, segment terminator, sub-element separator).
- Do not hardcode `*`, `~`, or `:` assumptions.
- If ISA parse fails, classify file as structurally invalid and quarantine with reason.

## 6) Matching Contract (835 -> 837)

Matching priority:

1. Exact `CLP01 == CLM01`
2. `CLP07` crosswalk to known claim references (for payer control IDs)
3. Secondary fallback using reference qualifiers (`REF`-based crosswalk) when configured
4. If still unmatched, insert payment unlinked (`claim_header_id = null`) and emit warning

No-match behavior:

- Never drop payment record.
- Always store unmatched reason code (`NO_MATCH_CLP01`, `NO_MATCH_CLP07`, etc.).

## 7) Error Handling Contract

Severity levels:

- `fatal`: structural file corruption (stop file, quarantine)
- `record_error`: one claim/payment record failed normalization (continue file)
- `warning`: unknown code/qualifier or non-critical format anomaly (continue record)

Batch behavior:

- Continue processing remaining records after `record_error`.
- Always write file log with counts: processed, errored, warned, unmatched.

## 8) Code Mapping Contract

- Mappings are data-driven config (versioned files), not hardcoded business logic.
- Unknown code behavior:
  - store raw value
  - map description to `Unknown`
  - emit warning metric
- Mapping updates must be backward compatible for existing canonical fields.

## 9) Output Contract (Parser -> Loader)

Guaranteed parser output envelope per file:

- `file_name`, `file_type`, `file_hash`, `record_count`
- `claims` (for 837) or `payments` (for 835)
- `parse_summary`:
  - `fatal_errors`
  - `record_errors`
  - `warnings`
  - `unknown_codes`
  - `unmatched_candidates` (835)

Loader must:

- accept nullable non-core fields
- reject only when required core identity fields are absent
- preserve parse summary in file audit log

## 10) Promotion Path (Simple -> Wider Coverage)

When a flex-layer pattern appears frequently:

1. Add mapping/config for qualifier/code
2. Add parser unit test with real sample snippet
3. Promote field to canonical only if it supports downstream product logic
4. Keep old behavior backward compatible

## 11) Release Gates (No Breaks)

Minimum pass criteria before production dataset expansion:

- Core parse success >= 99% records on validation corpus
- Unmatched 835 payments <= agreed threshold (initially 10%, then tighten)
- Zero fatal parser crashes on corpus
- All six dashboard RPCs return non-empty and numerically coherent outputs
- Reconciliation checks pass:
  - 837 line charge sums align with claim charge tolerances
  - 835 claim paid + adjustments are internally consistent

## 12) Practical v1 Implementation Checklist

- Add ISA-driven delimiter detection.
- Add `CLP07` extraction and persistence.
- Expand CAS parsing to capture all triplets per segment.
- Implement multi-strategy claim matching with explicit reason codes.
- Emit parse/load quality report per batch.
- Add regression fixtures for at least 3 payer formats.

---

This contract intentionally optimizes for reliability first: keep ingestion flowing, keep data auditable, and widen taxonomy safely by promotion rather than rewrite.
