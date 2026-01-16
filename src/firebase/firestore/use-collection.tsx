// src/firebase/firestore/use-collection.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { onSnapshot, getDocs, getDoc, doc, collection, where, query as firestoreQueryFn } from 'firebase/firestore';
import type { DocumentData, Query } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

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
      return String(firestoreQuery);
    } catch (e) {
      console.warn('Failed to create query key, falling back to String(query):', e);
      return String(firestoreQuery);
    }
  }, [firestoreQuery]);

  useEffect(() => {
    if (!firestoreQuery || !firestore) {
      setData([]);
      setLoading(false);
      return;
    }

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
          // Instead of running a collection query against /users (which requires list permissions),
          // fetch each user doc individually. This avoids triggering a global permission denied
          // error when the rules intentionally prevent listing the users collection.
          const userMap = new Map<string, any>();
          await Promise.all(userIds.map(async (uid: string) => {
            try {
              // Try university-scoped paths (fast then ned)
              const fastRef = doc(firestore, 'users', `fast_${uid}`);
              const fastSnap = await getDoc(fastRef);
              if (fastSnap.exists()) { userMap.set(uid, fastSnap.data()); return; }
              const nedRef = doc(firestore, 'users', `ned_${uid}`);
              const nedSnap = await getDoc(nedRef);
              if (nedSnap.exists()) { userMap.set(uid, nedSnap.data()); return; }
            } catch (err) {
              // Likely a permission-denied for this user; skip details for this uid but do not
              // emit a global permission error as that's noisy and expected in many setups.
              console.debug('Skipping user details for', uid, 'due to fetch error:', err);
            }
          }));

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
            setError(err);
          }
          setLoading(false);
        }
      );
      return () => unsubscribe();
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
            setError(err);
          }
          setLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, firestore, options.listen]);

  return { data, loading, error };
}
