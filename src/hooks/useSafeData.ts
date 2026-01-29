'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Safe Data Hook Types
 * Provides type-safe handling of loading, error, and data states
 */
export interface SafeDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isRefetching: boolean;
  isEmpty: boolean;
}

/**
 * useSafeData - Safe API data fetching with comprehensive error handling
 * 
 * Features:
 * - Automatic loading/error/empty state management
 * - Null/undefined safety checks
 * - Array/object empty state detection
 * - Built-in retry mechanism
 * - Memory leak prevention (cleanup on unmount)
 * - Race condition prevention
 */
export function useSafeData<T>(
  fetchFn: () => Promise<T>,
  options?: {
    skip?: boolean;
    onError?: (error: Error) => void;
    autoRetry?: boolean;
    retryDelay?: number;
  }
): SafeDataState<T> {
  const [state, setState] = useState<SafeDataState<T>>({
    data: null,
    loading: true,
    error: null,
    isRefetching: false,
    isEmpty: false,
  });

  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const fetchData = useCallback(async () => {
    if (options?.skip) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await fetchFn();

      // Check if data is empty
      const isEmpty =
        result === null ||
        result === undefined ||
        (Array.isArray(result) && result.length === 0) ||
        (typeof result === 'object' && Object.keys(result).length === 0);

      setState({
        data: result,
        loading: false,
        error: null,
        isRefetching: false,
        isEmpty,
      });
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Log error safely
      console.debug('[useSafeData] Error fetching data:', error.message);

      setState((prev) => ({
        ...prev,
        loading: false,
        error,
        isRefetching: false,
      }));

      // Call optional error handler
      options?.onError?.(error);

      // Auto-retry logic
      if (
        options?.autoRetry &&
        retryCount < maxRetries &&
        isRetryableError(error)
      ) {
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
        }, options?.retryDelay || 1000 * (retryCount + 1));
      }
    }
  }, [fetchFn, options, retryCount]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (options?.skip) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    let isMounted = true;

    const executeAsync = async () => {
      if (isMounted) {
        await fetchData();
      }
    };

    executeAsync();

    return () => {
      isMounted = false;
    };
  }, [fetchData, options?.skip, retryCount]);

  return state;
}

/**
 * Determine if an error is retryable
 * Network errors, timeouts, and 5xx errors are retryable
 * 401/403 permission errors are not retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable errors
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('not found')
  ) {
    return false;
  }

  // Retryable errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('connection')
  ) {
    return true;
  }

  return false;
}

/**
 * useSafeDataWithValidation - Safe data fetching with response validation
 * 
 * Validates API response before rendering
 * Handles malformed data gracefully
 */
export function useSafeDataWithValidation<T>(
  fetchFn: () => Promise<T>,
  validator?: (data: unknown) => data is T,
  options?: {
    skip?: boolean;
    onError?: (error: Error) => void;
    autoRetry?: boolean;
  }
): SafeDataState<T> {
  const handleFetch = useCallback(async () => {
    const result = await fetchFn();

    // Validate response if validator provided
    if (validator && !validator(result)) {
      throw new Error('API response validation failed: unexpected data format');
    }

    return result;
  }, [fetchFn, validator]);

  return useSafeData(handleFetch, options);
}

/**
 * Safe null check utility
 * Returns true if value is safely accessible
 */
export function isSafe<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Safe array access utility
 * Returns empty array if value is not an array
 */
export function toArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (isSafe(value)) return [value];
  return [];
}

/**
 * Safe object access utility
 * Returns empty object if value is not an object
 */
export function toObject<T extends Record<string, any>>(
  value: T | null | undefined
): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return {} as T;
}
