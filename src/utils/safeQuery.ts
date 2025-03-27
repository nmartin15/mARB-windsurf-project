import { PostgrestError } from '@supabase/supabase-js';
import { logError, ErrorCategory, LogLevel } from './errorLogger';

/**
 * Safely execute a Supabase query with error handling
 * @param queryFn Function that returns a Supabase query promise
 * @param context Context string for error logging
 * @returns Object with data and error properties
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  context: string
): Promise<{ data: T | null; error: PostgrestError | null }> {
  try {
    const result = await queryFn();
    
    if (result.error) {
      logError(`Error in ${context}`, LogLevel.ERROR, {
        context,
        category: ErrorCategory.DATABASE,
        data: result.error
      });
    }
    
    return result;
  } catch (err) {
    logError(`Exception in ${context}`, LogLevel.ERROR, {
      context,
      category: ErrorCategory.UNKNOWN,
      data: err,
      stack: err instanceof Error ? err.stack : undefined
    });
    
    return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown error' } as PostgrestError };
  }
}

/**
 * Extract detailed error information from a Supabase error
 * @param error PostgrestError object
 * @returns Formatted error details as a string
 */
export function extractSupabaseErrorDetails(error: PostgrestError | null): string {
  if (!error) return 'No error details available';
  
  return JSON.stringify({
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  });
}
