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

// Global flag to track if we're using mock data in development mode
export let usingMockData = false;

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
  // In development, we can fall back to console errors and use mock mode
  if (import.meta.env.DEV) {
    console.error('Supabase configuration error:', error);
    supabaseUrl = 'https://example.supabase.co';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    usingMockData = true;
    console.log('Development mode active - using mock data');
  } else {
    // In production, we should throw the error
    throw error;
  }
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add connection status check
(async () => {
  if (import.meta.env.DEV) {
    try {
      // Try to connect to Supabase
      const connectionStatus = await testSupabaseConnection();
      
      if (!connectionStatus.ok) {
        console.warn('Supabase connection failed. Using mock data in development mode.');
        usingMockData = true;
      } else {
        console.log('Supabase connected successfully');
      }
    } catch {
      // Silently handle the error and activate mock mode (no variable needed)
      usingMockData = true;
      console.log('Using mock data in development mode due to connection issues.');
    }
  }
})();

// Define a union type for Supabase errors
export type SupabaseError = PostgrestError | AuthError | Error;

// Add an improved error wrapper function that suppresses console errors in development mode
export function silentError(message: string, error: SupabaseError | unknown): void {
  if (!import.meta.env.DEV || !usingMockData) {
    console.error(message, error);
  } else {
    // In development mode with mock data, just log a debug message without the error
    console.debug(`[Mock Mode] Suppressed error: ${message}`);
  }
}

/**
 * Safely execute a Supabase query with error handling
 * @param queryFn Function that returns a Supabase query
 * @returns Result of the query with proper typing
 */
export async function safeQuery<T>(queryFn: () => Promise<{data: T | null; error: PostgrestError | AuthError | null}> | Promise<{data: unknown; error: unknown}>): Promise<{ data: T | null; error: PostgrestError | AuthError | Error | null }> {
  try {
    // If we're in development mode and using mock data, return null data without error
    if (import.meta.env.DEV && usingMockData) {
      return { data: null, error: null };
    }
    
    const response = await queryFn();
    
    // Handle the error based on its type
    if (response.error) {
      if (import.meta.env.DEV) {
        // In development mode, activate mock mode on error
        usingMockData = true;
        return { data: null, error: null };
      }
      
      if (isPostgrestError(response.error)) {
        silentError('PostgrestError in query:', response.error);
        return { data: null, error: response.error };
      } else if (isAuthError(response.error)) {
        silentError('AuthError in query:', response.error);
        return { data: null, error: response.error };
      } else {
        // Generic error handling
        silentError('Unknown error in query:', response.error);
        const genericError = new Error(String(response.error));
        return { data: null, error: genericError };
      }
    }
    
    return { 
      data: response.data as T, 
      error: null 
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      // In development mode, activate mock mode on error and return null
      usingMockData = true;
      return { data: null, error: null };
    }
    
    silentError('Exception during query:', error);
    const handledError = error instanceof Error ? error : new Error(String(error));
    return { data: null, error: handledError };
  }
}

// Type guards for error types
function isPostgrestError(error: unknown): error is PostgrestError {
  return (error as PostgrestError)?.code !== undefined;
}

function isAuthError(error: unknown): error is AuthError {
  return (error as AuthError)?.status !== undefined;
}

/**
 * Test the Supabase connection
 * @returns Connection status and error if any
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string; error?: PostgrestError | Error }> {
  try {
    // In development mode, we can attempt to connect even with mock data setup
    if (import.meta.env.DEV) {
      try {
        // Simple health check - see if we can retrieve a single record
        const { error } = await supabase
          .from('healthcare_claims')
          .select('claim_id')
          .limit(1);
          
        if (error) {
          // Silently handle error in development mode
          return { 
            ok: false, 
            message: `Could not connect to Supabase: ${error.message}`
          };
        }
        
        return {
          ok: true,
          message: 'Successfully connected to Supabase'
        };
      } catch (error) {
        // Silently handle error in development mode
        return {
          ok: false,
          message: `Connection test error: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
    
    // Original implementation for production
    // Check if we can connect to Supabase by running a simple query on the healthcare_claims table
    const { error: tableError } = await supabase
      .from('healthcare_claims')
      .select('claim_id')
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
    // which causes permission issues
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

// Auto-initialize mock mode check at import time
console.log('Supabase client initialized, development mode:', import.meta.env.DEV);