import { createClient, PostgrestError, AuthError } from '@supabase/supabase-js';

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

/**
 * Test the Supabase connection by querying the canonical schema.
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string; error?: PostgrestError | Error }> {
  try {
    const { error: tableError } = await supabase
      .from('claim_headers')
      .select('claim_id')
      .limit(1);

    if (tableError) {
      return {
        ok: false,
        message: `Could not access claim_headers table: ${tableError.message}`,
        error: tableError
      };
    }

    const { error: rpcError } = await supabase
      .rpc('get_trend_data', { p_period: '1M' })
      .limit(1);

    if (rpcError) {
      return {
        ok: true,
        message: `Connected to database, but get_trend_data RPC failed: ${rpcError.message}`,
        error: rpcError
      };
    }

    return {
      ok: true,
      message: 'Successfully connected to Supabase and verified required resources'
    };
  } catch (error) {
    return {
      ok: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
