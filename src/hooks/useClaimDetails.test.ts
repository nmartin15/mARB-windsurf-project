// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useClaimDetails } from './useClaimDetails';
import { safeQuery } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {},
  safeQuery: vi.fn(),
}));

describe('useClaimDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads details on first expand and caches for reopen', async () => {
    const safeQueryMock = vi.mocked(safeQuery);
    safeQueryMock
      .mockResolvedValueOnce({ data: [{ line_number: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ diagnosis_code: 'A00' }], error: null })
      .mockResolvedValueOnce({ data: [{ date_value: '20260101' }], error: null })
      .mockResolvedValueOnce({ data: [{ provider_role: 'billing' }], error: null })
      .mockResolvedValueOnce({ data: [{ paid_amount: 12.34 }], error: null });

    const { result } = renderHook(() => useClaimDetails());

    await act(async () => {
      await result.current.toggleClaimDetails(42);
    });

    expect(result.current.expandedClaim).toBe(42);
    expect(result.current.loadingClaimId).toBeNull();
    expect(result.current.claimDetail).not.toBeNull();
    expect(result.current.claimDetail?.lines).toHaveLength(1);
    expect(safeQueryMock).toHaveBeenCalledTimes(5);

    await act(async () => {
      await result.current.toggleClaimDetails(42);
    });
    expect(result.current.expandedClaim).toBeNull();

    await act(async () => {
      await result.current.toggleClaimDetails(42);
    });

    expect(result.current.expandedClaim).toBe(42);
    expect(result.current.claimDetail?.payments).toHaveLength(1);
    expect(safeQueryMock).toHaveBeenCalledTimes(5);
  });
});
