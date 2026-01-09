// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.debug('onAuthStateChanged:', { user: u, currentUser: auth.currentUser });
      setUser(u);

      // Ensure a users/{uid} document exists for the signed-in user. Run once on sign-in and do not overwrite existing data.
      if (u && firestore) {
        try {
          const userRef = doc(firestore, 'users', u.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            // Only create a users/{uid} document if the user's email is verified. If not verified yet, skip creation and wait for the user to verify and sign in again.
            if (!u.emailVerified) {
              console.debug('User is unverified; skipping users/{uid} creation for', u.uid);
            } else {
              // Prefer a pending university stored in localStorage (set at registration time), otherwise fall back to 'fast'
              let universityToSet: string | null = null;
              try {
                if (typeof window !== 'undefined') {
                  universityToSet = localStorage.getItem('pending_university');
                }
              } catch (err) {
                console.warn('Could not read pending_university from localStorage', err);
              }

              try {
                await setDoc(userRef, {
                  email: u.email || null,
                  university: universityToSet ?? 'fast',
                  createdAt: serverTimestamp()
                });
                console.debug('Created missing users document for', u.uid);
              } catch (err) {
                console.warn('Failed to create users/{uid} document:', err);
              } finally {
                try {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('pending_university');
                  }
                } catch (err) {
                  /* ignore */
                }
              }
            }
          }
        } catch (err) {
          console.warn('Failed to ensure users/{uid} document exists:', err);
        }
      }

      setLoading(false);
      if (!initialized) {
        setInitialized(true); // Mark as initialized once auth state is known
      }

      // No server-side admin session creation: admin gating is client-only now.
    });

    return () => unsubscribe();
  }, [auth, initialized]);

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
