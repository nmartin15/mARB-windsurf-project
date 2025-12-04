export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  providerId?: string;
  payerId?: string;
  procedureCode?: string;
  minAmount?: number;
  minClaimCount?: number;
}

export interface RevenueLeak {
  providerId: string;
  providerName?: string;
  payerId: string;
  payerName?: string;
  procedureCode: string;
  claimCount: number;
  totalBilled: number;
  totalPaid: number;
  revenueGap: number;
  collectionRatio: number;
  denialReasons: string[];
  claimId?: string;
  serviceDate?: Date;
  timestamp?: Date; // Keep for backward compatibility
  claimFilingIndicator?: string;
  billingProviderNpi?: string;
  attendingProviderNpi?: string;
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