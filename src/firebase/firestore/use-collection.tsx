// src/firebase/firestore/use-collection.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onSnapshot, getDocs, doc, DocumentData, Query, collection, where } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseCollectionOptions {
  listen?: boolean;
  includeUserDetails?: 'driverId' | 'passengerId';
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const sortedKeys = Object.keys(value).sort();
  const sortedObject = sortedKeys.map(key => `"${key}":${stableStringify(value[key])}`).join(',');
  return `{${sortedObject}}`;
}

export function useCollection<T extends DocumentData>(
  query: Query | null,
  options: UseCollectionOptions = { listen: true }
) {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryKey = useMemo(() => query ? `${stableStringify(query as any)}` : null, [query]);

  useEffect(() => {
    if (!query || !firestore) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const processSnapshot = async (snapshot: any) => {
      let items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      if (options.includeUserDetails && items.length > 0) {
        const userIds = [...new Set(items.map((item: any) => item[options.includeUserDetails!]).filter(Boolean))];
        if (userIds.length > 0) {
            
          const usersRef = collection(firestore, 'users');
          const userQuery = where('uid', 'in', userIds);
          const finalQuery = query(usersRef, userQuery);
          
          try {
            const userDocsSnapshot = await getDocs(finalQuery);
            const userMap = new Map();
            userDocsSnapshot.forEach(doc => {
                const userData = doc.data();
                userMap.set(userData.uid, userData);
            });
            items = items.map((item: any) => ({
                ...item,
                [`${options.includeUserDetails!.replace('Id', '')}Details`]: userMap.get(item[options.includeUserDetails!])
            }));
          } catch (e) {
            console.error("Failed to fetch user details for collection", e);
             const permissionError = new FirestorePermissionError({
                path: 'users',
                operation: 'list',
             });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
          }
        }
      }

      setData(items as T[]);
      setLoading(false);
      setError(null);
    };

    if (options.listen) {
      const unsubscribe = onSnapshot(
        query,
        (snapshot) => {
          processSnapshot(snapshot);
        },
        (err) => {
          console.error("onSnapshot error:", err);
          const permissionError = new FirestorePermissionError({
            path: (query as any)._query.path.segments.join('/'),
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      getDocs(query)
        .then(processSnapshot)
        .catch((err) => {
          console.error("getDocs error:", err);
          const permissionError = new FirestorePermissionError({
            path: (query as any)._query.path.segments.join('/'),
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, firestore, options.listen]);

  return { data, loading, error };
}
