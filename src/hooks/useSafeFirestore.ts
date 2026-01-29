'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Query, onSnapshot } from 'firebase/firestore';

/**
 * Safe Firestore Collection Hook
 * 
 * Provides comprehensive error handling for Firestore queries including:
 * - Permission denied errors
 * - Network errors
 * - Graceful degradation
 * - Memory leak prevention
 * - Race condition handling
 */
export interface SafeCollectionState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  isEmpty: boolean;
  isPermissionDenied: boolean;
  retryCount: number;
}

export function useSafeCollection<T extends { id?: string }>(
  query: Query | null,
  options?: {
    includeUserDetails?: string;
    onError?: (error: Error) => void;
    maxRetries?: number;
  }
): SafeCollectionState<T> {
  const [state, setState] = useState<SafeCollectionState<T>>({
    data: null,
    loading: true,
    error: null,
    isEmpty: false,
    isPermissionDenied: false,
    retryCount: 0,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSnapshot = useCallback(
    (docs: any[]) => {
      if (!isMountedRef.current) return;

      const items = docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];

      setState((prev) => ({
        ...prev,
        data: items,
        loading: false,
        error: null,
        isEmpty: items.length === 0,
        isPermissionDenied: false,
      }));
    },
    []
  );

  const handleError = useCallback(
    (error: any) => {
      if (!isMountedRef.current) return;

      console.debug('[useSafeCollection] Query error:', error?.code, error?.message);

      const isPermissionDenied =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission');

      setState((prev) => ({
        ...prev,
        error,
        loading: false,
        isPermissionDenied,
        data: isPermissionDenied ? [] : prev.data,
        isEmpty: isPermissionDenied ? true : prev.isEmpty,
      }));

      options?.onError?.(error);

      // Auto-retry for non-permission errors
      if (
        !isPermissionDenied &&
        (options?.maxRetries ?? 3) > state.retryCount
      ) {
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setState((prev) => ({
              ...prev,
              retryCount: prev.retryCount + 1,
            }));
          }
        }, 1000 * (state.retryCount + 1));
      }
    },
    [state.retryCount, options]
  );

  // Subscribe to collection changes
  useEffect(() => {
    if (!query) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          const docs = snapshot.docs || [];
          handleSnapshot(docs);
        },
        (error) => {
          handleError(error);
        }
      );
    } catch (err) {
      handleError(err);
    }

    return () => {
      unsubscribeRef.current?.();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [query, handleSnapshot, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      unsubscribeRef.current?.();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return state;
}

/**
 * Hook for safe document fetching
 */
export interface SafeDocumentState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  exists: boolean;
  isPermissionDenied: boolean;
}

export function useSafeDocument<T extends { id?: string }>(
  docQuery: Query | null
): SafeDocumentState<T> {
  const [state, setState] = useState<SafeDocumentState<T>>({
    data: null,
    loading: true,
    error: null,
    exists: false,
    isPermissionDenied: false,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!docQuery) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      unsubscribeRef.current = onSnapshot(
        docQuery,
        (doc) => {
          if (!isMountedRef.current) return;

          if (doc.exists()) {
            setState({
              data: { id: doc.id, ...doc.data() } as T,
              loading: false,
              error: null,
              exists: true,
              isPermissionDenied: false,
            });
          } else {
            setState({
              data: null,
              loading: false,
              error: null,
              exists: false,
              isPermissionDenied: false,
            });
          }
        },
        (error) => {
          if (!isMountedRef.current) return;

          const isPermissionDenied = error?.code === 'permission-denied';

          console.debug('[useSafeDocument] Error:', error?.message);

          setState({
            data: null,
            loading: false,
            error,
            exists: false,
            isPermissionDenied,
          });
        }
      );
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
        exists: false,
        isPermissionDenied: false,
      });
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [docQuery]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      unsubscribeRef.current?.();
    };
  }, []);

  return state;
}
