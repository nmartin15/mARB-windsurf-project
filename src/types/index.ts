export interface User {
  id: string;
  email: string;
  role: 'hospital' | 'insurer';
}

export interface HealthcareClaim {
  id: number;
  claim_id: string;
  total_claim_charge_amount: number;
  facility_type_code: string;
  facility_type_desc: string;
  facility_code_qualifier: string;
  facility_code_qualifier_desc: string;
  claim_frequency_type_code: string;
  claim_frequency_type_desc: string;
  service_date_start: string;
  service_date_end: string;
  admission_type_code: string;
  admission_type_desc: string;
  admission_source_code: string;
  admission_source_desc: string;
  patient_status_code: string;
  patient_status_desc: string;
  claim_filing_indicator_code: string;
  claim_filing_indicator_desc: string;
  assignment_code: string;
  assignment_desc: string;
  benefits_assignment: string;
  benefits_assignment_desc: string;
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