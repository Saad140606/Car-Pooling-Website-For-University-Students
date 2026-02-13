'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { emitNetworkError } from '@/components/NetworkErrorListener';
import { classifyError, isNetworkError } from '@/lib/networkErrorHandler';
import { fetchWithTimeout, FetchController } from '@/lib/fetchWithTimeout';

export interface UseFetchOptions {
  timeoutMs?: number;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  autoRetry?: boolean;
  showUserError?: boolean;
}

export interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
}

/**
 * Custom hook for fetching data with proper error handling
 * Automatically handles network errors, timeouts, and retries
 */
export function useFetch<T = any>(
  url: string | null,
  options: UseFetchOptions = {}
): UseFetchState<T> {
  const {
    timeoutMs = 30000,
    onError,
    onSuccess,
    autoRetry = true,
    showUserError = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const controllerRef = useRef<FetchController>(new FetchController());
  const attemptRef = useRef(0);
  const maxAttemptsRef = useRef(autoRetry ? 3 : 1);

  const fetch = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    attemptRef.current = 0;

    const attemptFetch = async (): Promise<void> => {
      attemptRef.current++;

      try {
        const controller = controllerRef.current;
        const signal = controller.getSignal(`fetch-${url}-${attemptRef.current}`);

        const response = await fetchWithTimeout(url, {
          timeoutMs,
          signal: signal as any,
        });

        const result = await response.json();
        setData(result);
        setError(null);
        setLoading(false);

        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error(`[useFetch] Fetch attempt ${attemptRef.current}/${maxAttemptsRef.current} failed:`, err);

        const classified = classifyError(err);

        // Show user-friendly error message
        if (showUserError) {
          if (isNetworkError(err)) {
            emitNetworkError(err);
          } else if (onError) {
            onError(err);
          }
        }

        // Retry if retryable and not exhausted
        if (autoRetry && classified.retryable && attemptRef.current < maxAttemptsRef.current) {
          const delayMs = Math.pow(2, attemptRef.current - 1) * 1000;
          console.debug(
            `[useFetch] Retrying in ${delayMs}ms (attempt ${attemptRef.current}/${maxAttemptsRef.current})`
          );

          await new Promise(resolve => setTimeout(resolve, delayMs));
          return attemptFetch();
        }

        // All retries exhausted or not retryable
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);

        if (onError) {
          onError(err);
        }
      }
    };

    try {
      await attemptFetch();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [url, timeoutMs, onError, onSuccess, autoRetry, showUserError]);

  // Initial fetch
  useEffect(() => {
    fetch();

    return () => {
      // Cleanup: abort any pending requests
      controllerRef.current.abortAll();
    };
  }, [fetch]);

  const retry = useCallback(async () => {
    attemptRef.current = 0;
    await fetch();
  }, [fetch]);

  return {
    data,
    loading,
    error,
    retry,
  };
}

/**
 * Hook for POST/PUT/DELETE requests with error handling
 */
export function useMutation<T = any, D = any>(
  options: UseFetchOptions = {}
) {
  const {
    timeoutMs = 30000,
    onError,
    onSuccess,
    showUserError = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const mutate = useCallback(
    async (
      url: string,
      method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
      body?: D,
      customOptions?: Partial<UseFetchOptions>
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithTimeout(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          timeoutMs: customOptions?.timeoutMs ?? timeoutMs,
        });

        const result = await response.json();
        setData(result);
        setLoading(false);

        if (onSuccess) {
          onSuccess();
        }

        return result;
      } catch (err) {
        console.error(`[useMutation] ${method} request failed:`, err);

        const classified = classifyError(err);

        // Show user-friendly error
        if (showUserError) {
          if (isNetworkError(err)) {
            emitNetworkError(err);
          } else if (customOptions?.onError) {
            customOptions.onError(err);
          } else if (onError) {
            onError(err);
          }
        }

        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);

        if (customOptions?.onError) {
          customOptions.onError(err);
        } else if (onError) {
          onError(err);
        }

        throw err;
      }
    },
    [timeoutMs, onError, onSuccess, showUserError]
  );

  return {
    data,
    loading,
    error,
    mutate,
  };
}
