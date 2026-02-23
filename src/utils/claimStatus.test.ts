import { describe, expect, it } from 'vitest';
import { getClaimStatusBadgeClass } from './claimStatus';

describe('getClaimStatusBadgeClass', () => {
  it('returns green styles for paid-like statuses', () => {
    expect(getClaimStatusBadgeClass('paid')).toContain('text-green-900');
    expect(getClaimStatusBadgeClass('accepted')).toContain('text-green-900');
  });

  it('returns fallback styles for unknown statuses', () => {
    expect(getClaimStatusBadgeClass('custom-status')).toContain('text-gray-900');
    expect(getClaimStatusBadgeClass(undefined)).toContain('text-gray-900');
  });
});
