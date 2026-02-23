import { describe, expect, it } from 'vitest';
import { buildClaimsSearchClause, getNextClaimsSortState } from './claimsList';

describe('claimsList utils', () => {
  describe('getNextClaimsSortState', () => {
    it('toggles direction for same sort field', () => {
      const result = getNextClaimsSortState({ sortField: 'created_at', sortAsc: false }, 'created_at');
      expect(result).toEqual({ sortField: 'created_at', sortAsc: true });
    });

    it('resets to ascending for new sort field', () => {
      const result = getNextClaimsSortState({ sortField: 'created_at', sortAsc: false }, 'claim_id');
      expect(result).toEqual({ sortField: 'claim_id', sortAsc: true });
    });
  });

  describe('buildClaimsSearchClause', () => {
    it('returns null for empty search term', () => {
      expect(buildClaimsSearchClause('   ')).toBeNull();
    });

    it('returns formatted OR clause for non-empty term', () => {
      expect(buildClaimsSearchClause('abc')).toBe(
        'claim_id.ilike.%abc%,payer_name.ilike.%abc%,patient_id.ilike.%abc%'
      );
    });
  });
});
