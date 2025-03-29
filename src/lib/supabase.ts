import { createClient, PostgrestError, AuthError } from '@supabase/supabase-js';

// Add type declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

// Define a custom error type for Supabase configuration errors
class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

// Get environment variables with validation
const getRequiredEnvVar = (name: string): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new SupabaseConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
};

// Get Supabase configuration from environment variables
let supabaseUrl: string;
let supabaseAnonKey: string;

try {
  supabaseUrl = getRequiredEnvVar('VITE_SUPABASE_URL');
  supabaseAnonKey = getRequiredEnvVar('VITE_SUPABASE_ANON_KEY');
} catch (error) {
  // In development, we can fall back to console errors
  if (import.meta.env.DEV) {
    console.error('Supabase configuration error:', error);
    supabaseUrl = 'https://example.supabase.co';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  } else {
    // In production, we should throw the error
    throw error;
  }
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define a union type for Supabase errors
export type SupabaseError = PostgrestError | AuthError | Error;

/**
 * Safely execute a Supabase query with error handling
 * @param queryFn Function that returns a Supabase query
 * @returns Result of the query with proper typing
 */
export async function safeQuery<T>(queryFn: () => Promise<{data: T | null; error: PostgrestError | AuthError | null}> | Promise<{data: unknown; error: unknown}>): Promise<{ data: T | null; error: PostgrestError | AuthError | Error | null }> {
  try {
    const response = await queryFn();
    
    // Handle the error based on its type
    let typedError: PostgrestError | AuthError | Error | null = null;
    if (response.error) {
      if (response.error instanceof Error) {
        typedError = response.error;
      } else {
        // Convert unknown error to Error
        typedError = new Error(String(response.error));
      }
    }
    
    return {
      data: response.data as T | null,
      error: typedError
    };
  } catch (error) {
    console.error('Error executing Supabase query:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Test the Supabase connection
 * @returns Connection status and error if any
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string; error?: PostgrestError | Error }> {
  try {
    // Check if we can connect to Supabase by running a simple query on the healthcare_claims table
    const { error: tableError } = await supabase
      .from('healthcare_claims')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('Error accessing healthcare_claims table:', tableError);
      return { 
        ok: false, 
        message: `Could not access healthcare_claims table: ${tableError.message}`,
        error: tableError
      };
    }

    // Simply attempt to call the function - we don't need to check if it exists through pg_proc
    // which causes permission errors
    const { error: trendError } = await supabase
      .rpc('get_trend_data', { period: '1M' })
      .limit(1);

    if (trendError) {
      console.warn('Error calling get_trend_data function:', trendError);
      return { 
        ok: true, 
        message: `Connected to database, but could not call the get_trend_data function: ${trendError.message}. Dashboard charts may not display correctly.`,
        error: trendError
      };
    }

    // Success - both table and function are accessible
    return { 
      ok: true, 
      message: 'Successfully connected to Supabase and verified required resources' 
    };
  } catch (error) {
    console.error('Unexpected error testing connection:', error);
    return { 
      ok: false, 
      message: `Unexpected error connecting to Supabase: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}