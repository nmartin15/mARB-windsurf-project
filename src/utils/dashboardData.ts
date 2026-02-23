import type { ClaimHeader, FilingIndicatorSummary } from '../types';

export type DashboardSummary = {
  totalAmount: number;
  avgClaimAmount: number;
  totalClaims: number;
  approvalRate: number;
  filingIndicators: FilingIndicatorSummary[];
  recentClaims: ClaimHeader[];
};

export function buildDashboardSummary(claimsData: ClaimHeader[] | null | undefined): DashboardSummary {
  if (!claimsData || claimsData.length === 0) {
    return {
      totalAmount: 0,
      avgClaimAmount: 0,
      totalClaims: 0,
      approvalRate: 0,
      filingIndicators: [],
      recentClaims: [],
    };
  }

  const totalAmount = claimsData.reduce((sum, claim) => sum + Number(claim.total_charge_amount || 0), 0);
  const totalClaims = claimsData.length;
  const paidOrAccepted = claimsData.filter((claim) => ['paid', 'accepted', 'partial'].includes(claim.claim_status)).length;
  const approvalRate = totalClaims > 0 ? (paidOrAccepted / totalClaims) * 100 : 0;

  const filingMap: Record<string, FilingIndicatorSummary> = {};
  claimsData.forEach((claim) => {
    const code = claim.claim_filing_indicator_code || 'UNK';
    const desc = claim.claim_filing_indicator_desc || 'Unknown';

    if (!filingMap[code]) {
      filingMap[code] = {
        originalName: code,
        displayName: desc,
        count: 0,
        total_amount: 0,
        average_amount: 0,
      };
    }

    filingMap[code].count += 1;
    filingMap[code].total_amount += Number(claim.total_charge_amount || 0);
  });

  Object.values(filingMap).forEach((indicator) => {
    indicator.average_amount = indicator.count > 0 ? indicator.total_amount / indicator.count : 0;
  });

  return {
    totalAmount,
    avgClaimAmount: totalClaims > 0 ? totalAmount / totalClaims : 0,
    totalClaims,
    approvalRate: Math.round(approvalRate * 10) / 10,
    filingIndicators: Object.values(filingMap),
    recentClaims: claimsData.slice(0, 5),
  };
}
