// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { useAuth, useFirestore } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { UserProfile } from '@/lib/types';


export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // New state

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setInitialized(true); // Mark as initialized even if auth is not available
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      setInitialized(true); // Mark as initialized once auth state is known
    });

    return () => unsubscribe();
  }, [auth]);

  const userDocRef = user && firestore ? doc(firestore, 'users', user.uid) : null;
  const { data, loading: dataLoading, error } = useDoc<UserProfile>(userDocRef);

  return { 
    user, 
    loading: loading || (user && dataLoading), // only be loading for data if a user exists
    data, 
    error, 
    initialized // Expose initialized state
  };
}
