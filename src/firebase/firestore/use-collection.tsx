// src/firebase/firestore/use-collection.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { onSnapshot, getDocs, getDoc, doc, collection, where, query as firestoreQueryFn } from 'firebase/firestore';
import type { DocumentData, Query } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { emitNetworkError } from '@/components/NetworkErrorListener';

interface UseCollectionOptions {
  listen?: boolean;
  includeUserDetails?: 'driverId' | 'passengerId';
}

function stableStringify(value: any, _seen?: WeakSet<object>, _depth: number = 0): string {
  // Protect against circular references and very deep objects.
  const seen = _seen ?? new WeakSet<object>();
  const maxDepth = 6;
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (seen.has(value)) {
    return '"[Circular]"';
  }
  if (_depth > maxDepth) {
    return '"[Truncated]"';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v, seen, _depth + 1)).join(',')}]`;
  }

  try {
    const keys = Object.keys(value).sort();
    const mapped = keys.map((key) => {
      // Only include primitive or plain object values to keep the string short and stable.
      try {
        return `"${key}":${stableStringify(value[key], seen, _depth + 1)}`;
      } catch (e) {
        return `"${key}":"[Unserializable]"`;
      }
    }).join(',');
    return `{${mapped}}`;
  } finally {
    // allow GC of seen for this branch
  }
}

export function useCollection<T extends DocumentData>(
  firestoreQuery: Query | null,
  options: UseCollectionOptions = { listen: true }
) {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Prefer a stable query key derived from the path; avoid deep stringify of the query object which can be circular.
  const queryKey = useMemo(() => {
    if (!firestoreQuery) return null;
    try {
      const path = (firestoreQuery as any)?._query?.path?.segments?.join('/');
      if (path) return path;
      // Try alternative internal structures for different Firebase SDK versions
      const altPath = (firestoreQuery as any)?.query?.path?.segments?.join('/');
      if (altPath) return altPath;
      return String(firestoreQuery);
    } catch (e) {
      console.warn('Failed to create query key, falling back to String(query):', e);
      return String(firestoreQuery);
    }
  }, [firestoreQuery]);

  // Track query key transitions to detect when query changes from null to valid.
  // During this transition, stale loading=false from the null query can cause a
  // one-frame flash of "no data" before the useEffect sets loading=true.
  // The ref tracks the queryKey for which data was last fetched.
  const dataForQueryKeyRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!firestoreQuery || !firestore) {
      dataForQueryKeyRef.current = null;
      setData([]);
      setLoading(false);
      return;
    }

    dataForQueryKeyRef.current = queryKey;
    setLoading(true);

    const processSnapshot = async (snapshot: any) => {
      let items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      if (options.includeUserDetails && items.length > 0) {
        // Collect user IDs and ensure they are strings to satisfy Firestore types.
        const userIds = [...new Set(items.map((item: any) => {
          const val = item[options.includeUserDetails!];
          return typeof val === 'string' && val ? val : undefined;
        }).filter(Boolean) as string[])];

        if (userIds.length > 0) {
          // OPTIMIZED: Fetch user documents in batches with concurrency limit
          // Get the current user's university from context if available
          const userUniversity = (firestore as any)?.app?.options?.projectId?.includes('fast') ? 'fast' : 'fast'; // Default to 'fast'
          
          const userMap = new Map<string, any>();
          
          // Fetch users in batches of 5 to avoid overwhelming Firebase
          const BATCH_SIZE = 5;
          for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (uid: string) => {
              try {
                // Try primary university first (most likely)
                const primaryRef = doc(firestore, 'universities', userUniversity, 'users', uid);
                const primarySnap = await getDoc(primaryRef);
                if (primarySnap.exists()) { 
                  userMap.set(uid, primarySnap.data()); 
                  return; 
                }
                
                // Fallback to alternative universities if primary doesn't have user
                const altRef = doc(firestore, 'universities', userUniversity === 'fast' ? 'ned' : 'fast', 'users', uid);
                const altSnap = await getDoc(altRef);
                if (altSnap.exists()) { 
                  userMap.set(uid, altSnap.data()); 
                  return; 
                }
              } catch (err) {
                // Skip this user on error (expected if no permissions)
                console.debug('Skipping user details for', uid, 'due to fetch error:', err);
              }
            }));
          }

          items = items.map((item: any) => ({
            ...item,
            // Preserve existing denormalized details on the document if fetching
            // user doc failed (userMap.get(...) may be undefined). This avoids
            // wiping out already-stored `passengerDetails`/`driverDetails`.
            [`${options.includeUserDetails!.replace('Id', '')}Details`]: userMap.get(item[options.includeUserDetails!]) || item[`${options.includeUserDetails!.replace('Id', '')}Details`]
          }));
        }
      }

      // Avoid unnecessary state updates if items are deeply equal by id and length.
      setData(prev => {
        const prevIds = ((prev || []) as any[]).map((p: any) => (p as any).id).join(',');
        const newIds = ((items || []) as any[]).map((i: any) => (i as any).id).join(',');
        if (prev && prev.length === items.length && prevIds === newIds) {
          return prev; // no change
        }
        return items as T[];
      });
      setLoading(false);
      setError(null);
    };

    if (options.listen) {
      const unsubscribe = onSnapshot(
        firestoreQuery,
        (snapshot) => {
          console.debug(`[useCollection] onSnapshot received ${snapshot.docs.length} documents for query:`, queryKey);
          processSnapshot(snapshot);
        },
        (err) => {
          console.error("onSnapshot error:", err);
          const code = (err && (err.code || err.code === 0)) ? err.code : (err?.message ? String(err.message) : '');
          if (code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
            const permissionError = new FirestorePermissionError({
              path: (firestoreQuery as any)?._query?.path?.segments?.join('/') ?? 'unknown',
              operation: 'list',
              hint: 'Make sure users/{uid} exists and your Firestore security rules allow listing this collection. See docs/firestore-rules.md for guidance.'
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
          } else {
            // Emit network error for non-permission errors
            emitNetworkError(err);
            setError(err);
          }
          setLoading(false);
        }
      );
      console.debug(`[useCollection] Real-time listener attached for query:`, queryKey);
      return () => {
        console.debug(`[useCollection] Unsubscribing from listener for query:`, queryKey);
        unsubscribe();
      };
    } else {
      getDocs(firestoreQuery)
        .then(processSnapshot)
        .catch((err) => {
          console.error("getDocs error:", err);
          const code = err?.code || '';
          if (code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
            const permissionError = new FirestorePermissionError({
              path: (firestoreQuery as any)?._query?.path?.segments?.join('/') ?? 'unknown',
              operation: 'list',
              hint: 'Make sure users/{uid} exists and your Firestore security rules allow listing this collection. See docs/firestore-rules.md for guidance.'
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
          } else {
            // Emit network error for non-permission errors
            emitNetworkError(err);
            setError(err);
          }
          setLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, firestore, options.listen]);

  // If the query just transitioned from null to a valid key but the effect hasn't
  // run yet (stale loading=false from null query), report as loading to prevent
  // a one-frame flash of "no data" in consuming components.
  const isQueryTransitioning = queryKey !== null && dataForQueryKeyRef.current !== queryKey;
  const effectiveLoading = loading || isQueryTransitioning;

  return { data, loading: effectiveLoading, error };
}
