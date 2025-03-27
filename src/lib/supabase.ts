import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add a simple wrapper for error handling
export const safeQuery = async <T>(queryFn: () => any): Promise<{ data: T | []; error: any }> => {
  try {
    const result = await queryFn();
    // Handle the case where result is a Supabase query builder
    if (result && typeof result.then === 'function') {
      const response = await result;
      return { 
        data: response.data || [] as unknown as T, 
        error: response.error 
      };
    }
    // Handle the case where result is already a response object
    return { 
      data: result.data || [] as unknown as T, 
      error: result.error 
    };
  } catch (error) {
    console.error('Supabase query error:', error);
    return { data: [] as unknown as T, error };
  }
};