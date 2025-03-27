/**
 * Error logging utility for consistent error handling across the application
 */

// Log levels
export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Error categories
export enum ErrorCategory {
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  UI = 'UI',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

interface ErrorLogOptions {
  context?: string;
  category?: ErrorCategory;
  data?: any;
  stack?: string;
}

/**
 * Log an error with consistent formatting and optional metadata
 * @param message Error message
 * @param level Log level
 * @param options Additional error context
 */
export function logError(
  message: string,
  level: LogLevel = LogLevel.ERROR,
  options: ErrorLogOptions = {}
) {
  const {
    context = 'App',
    category = ErrorCategory.UNKNOWN,
    data,
    stack
  } = options;

  const timestamp = new Date().toISOString();
  const errorObj = {
    timestamp,
    level,
    message,
    context,
    category,
    data: data || null,
    stack: stack || null
  };

  // Log to console with appropriate formatting
  const logPrefix = `[${level}] [${context}] [${category}]`;
  
  switch (level) {
    case LogLevel.INFO:
      console.info(`${logPrefix} ${message}`, data || '');
      break;
    case LogLevel.WARNING:
      console.warn(`${logPrefix} ${message}`, data || '');
      break;
    case LogLevel.ERROR:
    case LogLevel.CRITICAL:
      console.error(`${logPrefix} ${message}`, data || '');
      if (stack) {
        console.error(`${logPrefix} Stack trace:`, stack);
      }
      break;
    default:
      console.log(`${logPrefix} ${message}`, data || '');
  }

  // In a production app, you might send this to a logging service
  // sendToLoggingService(errorObj);
  
  return errorObj;
}

/**
 * Format an error object into a user-friendly message
 * @param error Error object
 * @returns Formatted error message
 */
export function formatErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error && error.error.message) return error.error.message;
  
  return JSON.stringify(error);
}

/**
 * Extract error details from a Supabase error
 * @param error Supabase error object
 * @returns Formatted error details
 */
export function extractSupabaseErrorDetails(error: any): { message: string, code: string, details: any } {
  if (!error) {
    return { message: 'Unknown error', code: 'UNKNOWN', details: null };
  }
  
  // Handle different Supabase error formats
  if (error.code && error.message) {
    return {
      message: error.message,
      code: error.code,
      details: error.details || null
    };
  }
  
  if (error.error_description) {
    return {
      message: error.error_description,
      code: error.error || 'AUTH_ERROR',
      details: error
    };
  }
  
  return {
    message: formatErrorMessage(error),
    code: 'UNKNOWN',
    details: error
  };
}
