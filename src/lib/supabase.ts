import { createClient, PostgrestError, AuthError } from '@supabase/supabase-js';
import { getReadinessMessage, isMissingRpcError, isMissingSchemaError, type AppReadinessStatus } from '../utils/appReadiness';

declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

const getRequiredEnvVar = (name: string): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new SupabaseConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
};

let supabaseUrl: string;
let supabaseAnonKey: string;

try {
  supabaseUrl = getRequiredEnvVar('VITE_SUPABASE_URL');
  supabaseAnonKey = getRequiredEnvVar('VITE_SUPABASE_ANON_KEY');
} catch (error) {
  if (import.meta.env.DEV) {
    console.error('Supabase configuration error:', error);
    supabaseUrl = 'https://placeholder.supabase.co';
    supabaseAnonKey = 'placeholder-key';
  } else {
    throw error;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseError = PostgrestError | AuthError | Error;

export function silentError(message: string, error: SupabaseError | unknown): void {
  console.error(message, error);
}

/**
 * Safely execute a Supabase query with error handling.
 * Returns { data, error } — callers should check error before using data.
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | AuthError | null }> | Promise<{ data: unknown; error: unknown }>
): Promise<{ data: T | null; error: PostgrestError | AuthError | Error | null }> {
  try {
    const response = await queryFn();

    if (response.error) {
      if (isPostgrestError(response.error)) {
        return { data: null, error: response.error };
      } else if (isAuthError(response.error)) {
        return { data: null, error: response.error };
      } else {
        return { data: null, error: new Error(String(response.error)) };
      }
    }

    return { data: response.data as T, error: null };
  } catch (error) {
    const handledError = error instanceof Error ? error : new Error(String(error));
    return { data: null, error: handledError };
  }
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (error as PostgrestError)?.code !== undefined;
}

function isAuthError(error: unknown): error is AuthError {
  return (error as AuthError)?.status !== undefined;
}

function isRpcSignatureResolutionError(error: PostgrestError | AuthError | Error | null): error is PostgrestError {
  if (!error || !isPostgrestError(error)) return false;
  const message = `${error.message} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (message.includes('could not find the function') && message.includes('schema cache'))
  );
}

export async function callTrendDataRpc(period: string, orgId: number | null = null) {
  const primary = await supabase.rpc('get_trend_data', { p_org_id: orgId, p_period: period });
  if (!primary.error || !isRpcSignatureResolutionError(primary.error)) {
    return primary;
  }

  // Backward compatibility for environments that still expose get_trend_data(p_period)
  return await supabase.rpc('get_trend_data', { p_period: period });
}

export async function callPaymentVelocityRpc(period: string, orgId: number | null = null) {
  const primary = await supabase.rpc('get_payment_velocity', { p_org_id: orgId, p_period: period });
  if (!primary.error || !isRpcSignatureResolutionError(primary.error)) {
    return primary;
  }

  // Backward compatibility for environments that still expose get_payment_velocity(p_period)
  return await supabase.rpc('get_payment_velocity', { p_period: period });
}

/**
 * Test the Supabase connection by querying the canonical schema.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  status: AppReadinessStatus;
  message: string;
  claimCount?: number;
  error?: PostgrestError | Error;
}> {
  try {
    const { error: tableError, count } = await supabase
      .from('claim_headers')
      .select('id', { count: 'exact', head: true });

    if (tableError) {
      const status = isMissingSchemaError(tableError) ? 'missing_schema' : 'error';
      return {
        ok: false,
        status,
        message: getReadinessMessage(status, `Could not access claim_headers table: ${tableError.message}`),
        error: tableError
      };
    }

    const rpcProbe = await callTrendDataRpc('1M', null);
    const rpcError = rpcProbe.error;

    if (rpcError) {
      const status = isMissingRpcError(rpcError) ? 'rpc_missing' : 'error';
      return {
        ok: status === 'rpc_missing',
        status,
        claimCount: count ?? 0,
        message: getReadinessMessage(status, `Connected to database, but get_trend_data RPC failed: ${rpcError.message}`),
        error: rpcError
      };
    }

    const claimCount = count ?? 0;
    if (claimCount === 0) {
      return {
        ok: true,
        status: 'empty_data',
        claimCount,
        message: getReadinessMessage('empty_data')
      };
    }

    return {
      ok: true,
      status: 'ready',
      claimCount,
      message: getReadinessMessage('ready', 'Successfully connected to Supabase and verified required resources')
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: getReadinessMessage('error', `Unexpected error: ${error instanceof Error ? error.message : String(error)}`),
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
