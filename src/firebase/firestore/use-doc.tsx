// src/firebase/firestore/use-doc.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onSnapshot, DocumentReference, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseDocOptions {
  listen?: boolean;
}

export function useDoc<T extends DocumentData>(
  docRef: DocumentReference | null,
  options: UseDocOptions = { listen: true }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const docRefPath = useMemo(() => docRef?.path, [docRef]);

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (options.listen) {
      const unsubscribe = onSnapshot(
        docRef,
        (doc) => {
          setData(doc.exists() ? ({ id: doc.id, ...doc.data() } as T) : null);
          setLoading(false);
          setError(null);
        },
        (err) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      docRef.get().then((doc) => {
        setData(doc.exists() ? ({ id: doc.id, ...doc.data() } as T) : null);
        setLoading(false);
      }).catch((err) => {
         const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
      });
    }
  }, [docRefPath, options.listen]);

  return { data, loading, error };
}
