import type { PostgrestError } from '@supabase/supabase-js';

export type AppReadinessStatus =
  | 'ready'
  | 'missing_schema'
  | 'empty_data'
  | 'rpc_missing'
  | 'error';

export function isMissingSchemaError(error: PostgrestError): boolean {
  const message = `${error.message} ${error.details ?? ''}`.toLowerCase();
  return error.code === '42P01' || message.includes('relation') && message.includes('does not exist');
}

export function isMissingRpcError(error: PostgrestError): boolean {
  const message = `${error.message} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    (message.includes('function') && message.includes('does not exist')) ||
    (message.includes('could not find the function') && message.includes('schema cache'))
  );
}

export function getReadinessMessage(status: AppReadinessStatus, details?: string): string {
  switch (status) {
    case 'missing_schema':
      return details ?? 'Database schema is missing required canonical tables.';
    case 'empty_data':
      return details ?? 'Connected to database, but no claim data is loaded yet.';
    case 'rpc_missing':
      return details ?? 'Connected to database, but reporting RPC functions are missing.';
    case 'error':
      return details ?? 'Unable to verify database readiness.';
    case 'ready':
    default:
      return details ?? 'Database is connected and ready.';
  }
}
