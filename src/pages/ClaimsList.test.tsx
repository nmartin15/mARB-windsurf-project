// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimsList } from './ClaimsList';
import { safeQuery } from '../lib/supabase';

const mockClaimsHeaderQuery = vi.hoisted(() => {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  } = {} as never;

  const range = vi.fn(async () => ({
    data: [
      {
        id: 42,
        claim_id: 'CLM-42',
        claim_type: 'professional',
        claim_status: 'paid',
        claim_filing_indicator_desc: 'Commercial',
        total_charge_amount: 120,
        paid_amount: 100,
        payer_name: 'Blue Payer',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    error: null,
    count: 1,
  }));
  chain.range = range;
  chain.or = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);

  return chain;
});

vi.mock('../components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../lib/supabase', () => {
  const buildDetailQuery = (data: Array<Record<string, unknown>>) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({ data, error: null })),
      })),
    })),
  });

  return {
    safeQuery: vi.fn(async (queryFn: () => Promise<{ data: unknown; error: unknown }>) => await queryFn()),
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'claim_headers') {
          return {
            select: mockClaimsHeaderQuery.select,
          };
        }

        if (table === 'claim_lines') return buildDetailQuery([{ line_number: 1, charge_amount: 50 }]);
        if (table === 'claim_diagnoses') return buildDetailQuery([{ diagnosis_code: 'A00', diagnosis_type: 'principal' }]);
        if (table === 'claim_dates') return buildDetailQuery([{ date_qualifier: 'DTP', date_value: '20260101' }]);
        if (table === 'claim_providers') return buildDetailQuery([{ provider_role: 'billing', last_or_org_name: 'Provider Org' }]);
        if (table === 'claim_payments') return buildDetailQuery([{ paid_amount: 100, payer_name: 'Blue Payer' }]);

        return buildDetailQuery([]);
      }),
    },
  };
});

describe('ClaimsList integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expands a claim row and reuses cached details on reopen', async () => {
    const user = userEvent.setup();
    const safeQueryMock = vi.mocked(safeQuery);

    render(<ClaimsList />);

    expect(await screen.findByText('CLM-42')).toBeTruthy();

    const toggleButton = screen.getByRole('button', { name: /expand details for claim CLM-42/i });
    await user.click(toggleButton);

    expect(await screen.findByText('Claim Info')).toBeTruthy();
    expect(screen.getByText(/Service Lines \(1\)/)).toBeTruthy();
    expect(safeQueryMock).toHaveBeenCalledTimes(5);

    const collapseButton = screen.getByRole('button', { name: /collapse details for claim CLM-42/i });
    await user.click(collapseButton);
    await waitFor(() => {
      expect(screen.queryByText('Claim Info')).toBeNull();
    });

    const reopenButton = screen.getByRole('button', { name: /expand details for claim CLM-42/i });
    await user.click(reopenButton);
    expect(await screen.findByText('Claim Info')).toBeTruthy();
    expect(safeQueryMock).toHaveBeenCalledTimes(5);
  });

});
