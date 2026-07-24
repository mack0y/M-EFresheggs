/**
 * Error handling utilities
 */

/** Common network-related error messages from Supabase/fetch */
const NETWORK_ERROR_PATTERNS = [
  'Failed to fetch',
  'NetworkError',
  'Network request failed',
  'net::ERR_',
  'network error',
  'could not connect',
  'timeout',
  'aborted',
  'TypeError: fetch',
];

/** User-friendly messages for common error types */
const ERROR_MESSAGES = {
  network: 'Unable to connect to the database. Please check your internet connection and try again.',
  auth: 'Authentication error. Please check your Supabase credentials in the .env file.',
  notFound: 'The requested data was not found.',
  server: 'The server encountered an error. Please try again later.',
  unknown: 'Something went wrong. Please try again.',
  validation: 'Please check your input and try again.',
  stock: 'Not enough stock for one or more items. Check product/egg stock levels and try again.',
  timeout: 'The request timed out. Please check your connection and try again.',
};

/**
 * Check if an error is a network/connection error
 */
export function isNetworkError(error) {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error.message || error.error_description || '');
  return NETWORK_ERROR_PATTERNS.some(pattern => msg.toLowerCase().includes(pattern.toLowerCase()));
}

/**
 * Get a user-friendly error message based on error type
 */
export function getUserFriendlyError(error) {
  if (!error) return ERROR_MESSAGES.unknown;
  const msg = typeof error === 'string' ? error : (error.message || error.error_description || '');

  if (isNetworkError(error)) return ERROR_MESSAGES.network;
  if (msg.includes('JWT') || msg.includes('Auth') || msg.includes('auth') || msg.includes('key')) return ERROR_MESSAGES.auth;
  if (msg.includes('not found') || msg.includes('No rows')) return ERROR_MESSAGES.notFound;
  if (msg.includes('Not enough') || msg.includes('Insufficient stock')) return ERROR_MESSAGES.stock;
  if (msg.includes('timeout') || msg.includes('Timed out')) return ERROR_MESSAGES.timeout;
  if (msg.includes('violates') || msg.includes('constraint') || msg.includes('invalid input')) return ERROR_MESSAGES.validation;

  return ERROR_MESSAGES.unknown;
}

/**
 * Retry wrapper for async functions with exponential backoff
 */
export async function withRetry(fn, { maxRetries = 2, baseDelay = 1000, onRetry = null } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Only retry on network errors
      if (!isNetworkError(error)) throw error;
      if (attempt < maxRetries) {
        if (onRetry) onRetry(attempt, maxRetries);
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}
