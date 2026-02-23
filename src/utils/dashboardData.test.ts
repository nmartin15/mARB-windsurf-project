import { describe, expect, it } from 'vitest';
import type { ClaimHeader } from '../types';
import { buildDashboardSummary } from './dashboardData';

function makeClaim(overrides: Partial<ClaimHeader>): ClaimHeader {
  return {
    id: 1,
    claim_id: 'CLM-1',
    claim_type: 'professional',
    claim_status: 'submitted',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildDashboardSummary', () => {
  it('returns empty summary for empty input', () => {
    const summary = buildDashboardSummary([]);
    expect(summary.totalClaims).toBe(0);
    expect(summary.totalAmount).toBe(0);
    expect(summary.filingIndicators).toEqual([]);
  });

  it('computes totals, averages, approval rate, and filing buckets', () => {
    const claims: ClaimHeader[] = [
      makeClaim({
        id: 1,
        claim_id: 'A',
        claim_status: 'paid',
        total_charge_amount: 100,
        claim_filing_indicator_code: 'MC',
        claim_filing_indicator_desc: 'Medicare',
      }),
      makeClaim({
        id: 2,
        claim_id: 'B',
        claim_status: 'denied',
        total_charge_amount: 50,
        claim_filing_indicator_code: 'MC',
        claim_filing_indicator_desc: 'Medicare',
      }),
      makeClaim({
        id: 3,
        claim_id: 'C',
        claim_status: 'accepted',
        total_charge_amount: 150,
        claim_filing_indicator_code: 'CI',
        claim_filing_indicator_desc: 'Commercial',
      }),
    ];

    const summary = buildDashboardSummary(claims);
    expect(summary.totalClaims).toBe(3);
    expect(summary.totalAmount).toBe(300);
    expect(summary.avgClaimAmount).toBe(100);
    expect(summary.approvalRate).toBeCloseTo(66.7, 1);
    expect(summary.filingIndicators).toHaveLength(2);
    expect(summary.recentClaims).toHaveLength(3);
  });
});
