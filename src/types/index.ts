// =============================================================================
// Core domain types matching the canonical database schema
// =============================================================================

export interface Organization {
  id: number;
  name: string;
  npi?: string;
  tax_id?: string;
  org_type: 'physician_practice' | 'hospital' | 'health_system';
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  created_at: string;
  updated_at: string;
}

export interface ClaimHeader {
  id: number;
  org_id?: number;
  claim_id: string;
  claim_type: 'professional' | 'institutional';
  file_name?: string;
  file_type?: '837P' | '837I';
  total_charge_amount?: number;
  paid_amount?: number;
  allowed_amount?: number;
  patient_responsibility?: number;
  claim_status: string;
  facility_type_code?: string;
  facility_type_desc?: string;
  facility_code_qualifier?: string;
  facility_code_qualifier_desc?: string;
  claim_frequency_type_code?: string;
  claim_frequency_type_desc?: string;
  place_of_service_code?: string;
  place_of_service_desc?: string;
  assignment_code?: string;
  assignment_desc?: string;
  benefits_assignment?: string;
  benefits_assignment_desc?: string;
  release_of_info_code?: string;
  claim_filing_indicator_code?: string;
  claim_filing_indicator_desc?: string;
  payer_responsibility_code?: string;
  payer_responsibility_desc?: string;
  admission_type_code?: string;
  admission_type_desc?: string;
  admission_source_code?: string;
  admission_source_desc?: string;
  patient_status_code?: string;
  patient_status_desc?: string;
  prior_auth_number?: string;
  prior_auth_status?: string;
  original_claim_id?: string;
  resubmission_code?: string;
  is_clean_claim?: boolean;
  payer_id?: string;
  payer_name?: string;
  patient_id?: string;
  prediction_score?: number;
  prediction_factors?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClaimLine {
  id: number;
  claim_header_id: number;
  line_number: number;
  procedure_code?: string;
  procedure_desc?: string;
  procedure_qualifier?: string;
  procedure_qualifier_desc?: string;
  modifier_1?: string;
  modifier_2?: string;
  modifier_3?: string;
  modifier_4?: string;
  revenue_code?: string;
  revenue_code_desc?: string;
  charge_amount?: number;
  paid_amount?: number;
  allowed_amount?: number;
  unit_count?: number;
  unit_measurement_code?: string;
  unit_measurement_desc?: string;
  place_of_service_code?: string;
  created_at: string;
}

export interface ClaimDiagnosis {
  id: number;
  claim_header_id: number;
  diagnosis_code: string;
  diagnosis_type: 'principal' | 'admitting' | 'other' | 'reason_for_visit' | 'external_cause' | 'drg';
  code_qualifier?: string;
  code_qualifier_desc?: string;
  sequence_number: number;
  created_at: string;
}

export interface ClaimDate {
  id: number;
  claim_header_id: number;
  claim_line_id?: number;
  date_qualifier: string;
  date_qualifier_desc?: string;
  date_format_qualifier?: string;
  date_value: string;
  parsed_date?: string;
  parsed_date_end?: string;
  created_at: string;
}

export interface ClaimProvider {
  id: number;
  claim_header_id: number;
  provider_role: 'billing' | 'rendering' | 'attending' | 'referring' | 'operating' | 'supervising' | 'service_location' | 'other';
  entity_identifier_code?: string;
  entity_type_qualifier?: string;
  npi?: string;
  tax_id?: string;
  id_code_qualifier?: string;
  last_or_org_name?: string;
  first_name?: string;
  middle_name?: string;
  taxonomy_code?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  created_at: string;
}

export interface ClaimPayment {
  id: number;
  claim_header_id?: number;
  org_id?: number;
  file_name?: string;
  patient_control_number: string;
  claim_status_code?: string;
  claim_status_desc?: string;
  total_charge_amount?: number;
  paid_amount?: number;
  patient_responsibility?: number;
  payer_id?: string;
  payer_name?: string;
  check_number?: string;
  payment_date?: string;
  payment_method_code?: string;
  claim_filing_indicator_code?: string;
  created_at: string;
}

export interface ClaimAdjustment {
  id: number;
  claim_payment_id?: number;
  claim_payment_line_id?: number;
  adjustment_group_code: 'CO' | 'PR' | 'OA' | 'PI' | 'CR';
  adjustment_group_desc?: string;
  carc_code: string;
  carc_description?: string;
  adjustment_amount?: number;
  adjustment_quantity?: number;
  rarc_code?: string;
  rarc_description?: string;
  created_at: string;
}

export interface PayerDirectory {
  id: number;
  payer_id: string;
  payer_name: string;
  payer_type?: string;
}

export interface EdiFileLog {
  id: number;
  org_id?: number;
  file_name: string;
  file_type: '837P' | '837I' | '835';
  file_hash?: string;
  record_count?: number;
  status: 'processing' | 'processed' | 'failed' | 'duplicate';
  error_message?: string;
  processed_at: string;
}

// =============================================================================
// Dashboard / chart data types
// =============================================================================

export interface PaymentVelocityData {
  month: string;
  amount: number;
  disputes_closed: number;
  days_to_payment: number;
}

export interface TrendData {
  range: string;
  count: number;
  avgDays: number;
}

export interface FilingIndicatorSummary {
  originalName: string;
  displayName: string;
  count: number;
  total_amount: number;
  average_amount: number;
}

// =============================================================================
// User / auth types
// =============================================================================

export interface User {
  id: string;
  email: string;
  role: 'hospital' | 'insurer';
}

export interface UserProfile {
  id: string;
  org_id?: number;
  full_name?: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface KPIData {
  disputeResolutionRate: number;
  successRate: number;
}

export interface Alert {
  id: string;
  disputeId: string;
  amount: number;
  trend: 'up' | 'down';
}

// Backward compatibility alias
export type HealthcareClaim = ClaimHeader;
