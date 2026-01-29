'use client';

/**
 * API Response Validation & Safe Access Utilities
 * 
 * Ensures all API responses are validated before rendering
 * Handles network errors, malformed data, and missing fields gracefully
 */

/**
 * SafeResponse wrapper for all API responses
 * Provides consistent error handling across the app
 */
export class SafeResponse<T> {
  constructor(
    public success: boolean,
    public data: T | null,
    public error: string | null = null,
    public statusCode: number = 200
  ) {}

  static success<T>(data: T, statusCode = 200): SafeResponse<T> {
    return new SafeResponse(true, data, null, statusCode);
  }

  static error<T>(error: string, statusCode = 500): SafeResponse<T> {
    return new SafeResponse(false, null, error, statusCode);
  }

  static fromError<T>(err: unknown): SafeResponse<T> {
    const message = err instanceof Error ? err.message : String(err);
    return SafeResponse.error<T>(message, 500);
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  isNetworkError(): boolean {
    return this.statusCode === 0 || !this.success;
  }
}

/**
 * Response validator functions
 */
export const validators = {
  /**
   * Validate Booking response
   */
  isBooking(data: unknown): data is any {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as any;
    return (
      typeof obj.id === 'string' &&
      typeof obj.passengerId === 'string' &&
      (obj.rideId === undefined || typeof obj.rideId === 'string')
    );
  },

  /**
   * Validate array of bookings
   */
  isBookingArray(data: unknown): data is any[] {
    return Array.isArray(data) && (data.length === 0 || validators.isBooking(data[0]));
  },

  /**
   * Validate Ride response
   */
  isRide(data: unknown): data is any {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as any;
    return (
      typeof obj.id === 'string' &&
      typeof obj.from === 'string' &&
      typeof obj.to === 'string'
    );
  },

  /**
   * Validate array of rides
   */
  isRideArray(data: unknown): data is any[] {
    return Array.isArray(data) && (data.length === 0 || validators.isRide(data[0]));
  },

  /**
   * Validate Chat response
   */
  isChat(data: unknown): data is any {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as any;
    return typeof obj.id === 'string';
  },

  /**
   * Validate array of chats
   */
  isChatArray(data: unknown): data is any[] {
    return Array.isArray(data) && (data.length === 0 || validators.isChat(data[0]));
  },

  /**
   * Validate generic array
   */
  isArray(data: unknown): data is any[] {
    return Array.isArray(data);
  },

  /**
   * Validate generic object
   */
  isObject(data: unknown): data is Record<string, any> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  },
};

/**
 * Safe field access utility
 * Returns default value if field is missing or invalid
 */
export function safeGet<T = any>(
  obj: any,
  path: string,
  defaultValue?: T
): T {
  try {
    if (!obj || typeof obj !== 'object') return defaultValue as T;

    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      current = current?.[key];
      if (current === undefined || current === null) {
        return defaultValue as T;
      }
    }

    return current as T;
  } catch (e) {
    return defaultValue as T;
  }
}

/**
 * Safe string formatting
 * Prevents crashes from null/undefined values
 */
export function safeString(value: any, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * Safe number formatting
 */
export function safeNumber(value: any, defaultValue = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Safe array mapping with error handling
 * Skips invalid items instead of crashing
 */
export function safeMap<T, R>(
  items: T[] | null | undefined,
  fn: (item: T, index: number) => R
): R[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      try {
        return fn(item, index);
      } catch (e) {
        console.debug('[safeMap] Error mapping item:', e);
        return null as any;
      }
    })
    .filter((item) => item !== null);
}

/**
 * Async wrapper for API calls with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  defaultValue: T | null = null
): Promise<SafeResponse<T>> {
  try {
    const result = await fn();
    return SafeResponse.success(result);
  } catch (err) {
    if (err instanceof Error) {
      return SafeResponse.error(err.message);
    }
    return SafeResponse.error(String(err));
  }
}
