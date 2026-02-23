import { describe, expect, it } from 'vitest';
import { getReadinessMessage, isMissingRpcError, isMissingSchemaError } from './appReadiness';

describe('appReadiness helpers', () => {
  it('detects missing schema errors from postgres code', () => {
    const error = {
      code: '42P01',
      message: 'relation "public.claim_headers" does not exist',
      details: null,
    };

    expect(isMissingSchemaError(error as any)).toBe(true);
  });

  it('detects missing rpc errors from postgres code', () => {
    const error = {
      code: '42883',
      message: 'function get_trend_data(text) does not exist',
      details: null,
    };

    expect(isMissingRpcError(error as any)).toBe(true);
  });

  it('detects missing rpc errors from PostgREST schema cache code', () => {
    const error = {
      code: 'PGRST202',
      message: 'Could not find the function public.get_trend_data(p_period) in the schema cache',
      details: null,
    };

    expect(isMissingRpcError(error as any)).toBe(true);
  });

  it('returns friendly setup message for missing schema', () => {
    expect(getReadinessMessage('missing_schema')).toContain('schema');
  });
});
