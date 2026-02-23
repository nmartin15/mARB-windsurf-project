export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  providerId?: string;
  payerId?: string;
  procedureCode?: string;
  minAmount?: number;
  minClaimCount?: number;
  period?: string;
  orgId?: number;
}

export interface RevenueLeak {
  claimId: string;
  providerId?: string;
  providerName?: string;
  payerId?: string;
  payerName?: string;
  procedureCode?: string;
  serviceDate?: string;
  claimFilingIndicator?: string;
  billingProviderNpi?: string;
  attendingProviderNpi?: string;
  totalBilled: number;
  totalPaid: number;
  revenueGap: number;
  collectionRatio: number;
  denialReasons: string[];
  claimStatus?: string;
}

export interface ARAgingRow {
  payer_id: string;
  payer_name: string;
  amount_0_30: number;
  amount_31_60: number;
  amount_61_90: number;
  amount_91_120: number;
  amount_120_plus: number;
  count_0_30: number;
  count_31_60: number;
  count_61_90: number;
  count_91_120: number;
  count_120_plus: number;
}

export interface DenialSummaryRow {
  carc_code: string;
  carc_description: string;
  adjustment_group: string;
  payer_id: string;
  payer_name: string;
  denial_count: number;
  total_denied_amount: number;
}

export interface PayerPerformanceRow {
  payer_id: string;
  payer_name: string;
  total_claims: number;
  total_charged: number;
  total_paid: number;
  avg_days_to_payment: number;
  denial_rate: number;
  reimbursement_rate: number;
}

export interface CleanClaimRateRow {
  period_label: string;
  total_claims: number;
  clean_claims: number;
  clean_claim_rate: number;
  denied_claims: number;
  rejected_claims: number;
}

export interface CollectionTimeline {
  submissionMonth: string;
  providerId: string;
  payerId: string;
  totalClaims: number;
  avgDaysToPayment: number;
  unpaidAmount: number;
  unpaidClaims: number;
}

export interface ProcedureReimbursement {
  procedureCode: string;
  providerId: string;
  payerId: string;
  procedureCount: number;
  avgBilled: number;
  avgPaid: number;
  reimbursementRate: number;
  rateVariance: number;
}

export interface ProviderPerformance {
  providerId: string;
  totalClaims: number;
  totalBilled: number;
  totalCollected: number;
  avgCollectionDays: number;
  denialRate: number;
  collectionRatio: number;
}

export interface ClaimsAging {
  providerId: string;
  payerId: string;
  amount_0_30: number;
  amount_31_60: number;
  amount_61_90: number;
  amount_90_plus: number;
  count_0_30: number;
  count_31_60: number;
  count_61_90: number;
  count_90_plus: number;
}

export interface ReportMetadata {
  title: string;
  description: string;
  lastUpdated: Date;
  filters: ReportFilters;
}
