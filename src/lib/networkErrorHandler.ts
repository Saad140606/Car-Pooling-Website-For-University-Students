/**
 * Network error detection and classification
 * Differentiates between network errors, timeouts, server errors, and app errors
 */

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  OFFLINE = 'offline',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error',
  NOT_FOUND = 'not_found',
  PERMISSION_DENIED = 'permission_denied',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN = 'unknown',
}

export interface NetworkError {
  type: ErrorType;
  message: string;
  userMessage: string;
  originalError: Error | null;
  statusCode?: number;
  retryable: boolean;
}

/**
 * Classify an error and return user-friendly message
 */
export function classifyError(error: unknown): NetworkError {
  if (error instanceof TypeError) {
    // TypeError usually means network/offline error
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network request failed',
        userMessage: 'Unable to connect. Please check your internet connection.',
        originalError: error,
        retryable: true,
      };
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Timeout detection
    if (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('deadline') ||
      msg.includes('408')
    ) {
      return {
        type: ErrorType.TIMEOUT,
        message: 'Request timeout',
        userMessage: 'The request took too long. Please check your connection and try again.',
        originalError: error,
        statusCode: 408,
        retryable: true,
      };
    }

    // Network-specific errors
    if (
      msg.includes('ERR_INTERNET_DISCONNECTED') ||
      msg.includes('ERR_ADDRESS_UNREACHABLE') ||
      msg.includes('ERR_NAME_NOT_RESOLVED')
    ) {
      return {
        type: ErrorType.OFFLINE,
        message: 'No internet connection',
        userMessage: 'You appear to be offline. Please connect to the internet and try again.',
        originalError: error,
        retryable: true,
      };
    }

    // Permission errors
    if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('403')) {
      return {
        type: ErrorType.PERMISSION_DENIED,
        message: 'Permission denied',
        userMessage: 'You do not have permission to access this content.',
        originalError: error,
        statusCode: 403,
        retryable: false,
      };
    }

    // Not found
    if (msg.includes('404') || msg.includes('not found')) {
      return {
        type: ErrorType.NOT_FOUND,
        message: 'Resource not found',
        userMessage: 'The requested content could not be found.',
        originalError: error,
        statusCode: 404,
        retryable: false,
      };
    }

    // Server errors (5xx)
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return {
        type: ErrorType.SERVER_ERROR,
        message: 'Server error',
        userMessage: 'The server is having trouble. Please try again in a moment.',
        originalError: error,
        statusCode: 500,
        retryable: true,
      };
    }

    // Validation errors
    if (msg.includes('validation') || msg.includes('invalid')) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Validation error',
        userMessage: error.message,
        originalError: error,
        retryable: false,
      };
    }
  }

  // Check if offline based on navigator status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      type: ErrorType.OFFLINE,
      message: 'Device is offline',
      userMessage: 'You appear to be offline. Please connect to the internet and try again.',
      originalError: error instanceof Error ? error : null,
      retryable: true,
    };
  }

  // Generic network error
  return {
    type: ErrorType.UNKNOWN,
    message: error instanceof Error ? error.message : String(error),
    userMessage: 'Something went wrong. Please try again.',
    originalError: error instanceof Error ? error : null,
    retryable: true,
  };
}

/**
 * Determine if an error is a network-related issue
 */
export function isNetworkError(error: unknown): boolean {
  const classified = classifyError(error);
  return [
    ErrorType.NETWORK_ERROR,
    ErrorType.OFFLINE,
    ErrorType.TIMEOUT,
  ].includes(classified.type);
}

/**
 * Determine if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  return classifyError(error).retryable;
}

/**
 * Format error for logging (not shown to user)
 */
export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack}`;
  }
  return String(error);
}
