'use client';

import { useState, useCallback, useRef } from 'react';
import { isRetryable } from '@/lib/networkErrorHandler';

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, delay: number) => void;
}

interface RetryState {
  isRetrying: boolean;
  attempt: number;
  nextRetryTime: Date | null;
}

/**
 * Hook for implementing retry logic with exponential backoff
 * Automatically retries failed requests with increasing delays
 */
export function useRetry<T>(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    nextRetryTime: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const retry = useCallback(
    async (
      fn: () => Promise<T>,
      onError?: (error: unknown, attempt: number) => void
    ): Promise<T | null> => {
      let lastError: unknown;
      let attempt = 0;

      while (attempt < maxAttempts) {
        try {
          const result = await fn();
          setState({
            isRetrying: false,
            attempt: 0,
            nextRetryTime: null,
          });
          return result;
        } catch (error) {
          attempt++;
          lastError = error;

          // Check if error is retryable
          if (!isRetryable(error)) {
            if (onError) onError(error, attempt);
            setState({
              isRetrying: false,
              attempt: 0,
              nextRetryTime: null,
            });
            throw error;
          }

          // If we've exhausted retries, give up
          if (attempt >= maxAttempts) {
            if (onError) onError(error, attempt);
            setState({
              isRetrying: false,
              attempt: 0,
              nextRetryTime: null,
            });
            throw error;
          }

          // Calculate backoff delay
          const delayMs = Math.min(
            initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
            maxDelayMs
          );

          const retryTime = new Date(Date.now() + delayMs);
          setState({
            isRetrying: true,
            attempt,
            nextRetryTime: retryTime,
          });

          if (onRetry) {
            onRetry(attempt, delayMs);
          }

          console.debug(
            `[Retry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`,
            error
          );

          // Wait before retrying
          await new Promise(resolve => {
            timeoutRef.current = setTimeout(resolve, delayMs);
          });
        }
      }

      // All retries exhausted
      if (onError) onError(lastError, maxAttempts);
      throw lastError;
    },
    [maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier, onRetry]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState({
      isRetrying: false,
      attempt: 0,
      nextRetryTime: null,
    });
  }, []);

  return {
    retry,
    cancel,
    ...state,
  };
}
