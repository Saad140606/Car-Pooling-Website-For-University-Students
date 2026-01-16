// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc, runTransaction } from 'firebase/firestore';
import { getPendingUniversity, clearPendingUniversity, isValidUniversity, getPendingGender, clearPendingGender } from '@/lib/university';

import { useAuth, useFirestore } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { UserProfile } from '@/lib/types';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';


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
    const prevUidRef = { current: null as string | null };

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.debug('onAuthStateChanged:', { user: u, currentUser: auth.currentUser });
      setUser(u);

      // Ensure a users/{university}/{uid} document exists for the signed-in user. Run once on sign-in and do not overwrite existing data.
      if (u && firestore) {
        try {
          const userFastRef = doc(firestore, 'users', `fast_${u.uid}`);
          const userNedRef = doc(firestore, 'users', `ned_${u.uid}`);
          const snapFast = await getDoc(userFastRef);
          const snapNed = await getDoc(userNedRef);

          // If user doc exists in either university, do nothing here — the app will read it below.
          if (!snapFast.exists() && !snapNed.exists()) {
            // Only create profile if email verified
            if (!u.emailVerified) {
              console.debug('User is unverified; skipping users/{university}/{uid} creation for', u.uid);
            } else {
              // Prefer pending university, otherwise fall back to 'fast'
              let universityToSet: string | null = null;
              try { universityToSet = getPendingUniversity(); } catch (err) { console.warn('Could not read pending_university from localStorage', err); }
              const finalUniversity = isValidUniversity(universityToSet) ? universityToSet as string : 'fast';
              const pendingGender = getPendingGender();
              const profile: any = { email: u.email || null, university: finalUniversity, createdAt: serverTimestamp() };
              if (pendingGender) profile.gender = pendingGender;

              try {
                await setDoc(doc(firestore, 'users', `${finalUniversity}_${u.uid}`), profile);
                console.debug('Created university-scoped users document for', u.uid, 'under', finalUniversity);
              } catch (err) {
                console.warn('Failed to create users/{university}/{uid} document:', err);
              } finally {
                try { clearPendingUniversity(); clearPendingGender(); } catch (err) { /* ignore */ }
              }
            }
          }
        } catch (err) {
          console.warn('Failed to ensure users/{uid} document exists:', err);
        }

      // Register FCM token for signed-in users (and remove on sign-out)
      try {
        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
          const messaging = getMessaging();

          if (u) {
            try {
              if ('Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') {
                  console.debug('Notification permission not granted');
                }
              }

              const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
              if (token) {
                // Determine the university for this user doc (prefer existing docs)
                const fastSnap = await getDoc(doc(firestore, 'users', `fast_${u.uid}`));
                const nedSnap = await getDoc(doc(firestore, 'users', `ned_${u.uid}`));
                let finalUniversity = 'fast';
                if (fastSnap.exists()) finalUniversity = 'fast';
                else if (nedSnap.exists()) finalUniversity = 'ned';
                else {
                  // Fall back to pending university if available
                  try { const pending = getPendingUniversity(); if (isValidUniversity(pending)) finalUniversity = pending as string; } catch (_) {}
                }

                // Atomically update a single token document per user that only the server should read.
                const tokenDocRef = doc(firestore, 'fcm_tokens', u.uid);
                try {
                  await runTransaction(firestore, async (tx) => {
                    const cur = await tx.get(tokenDocRef);
                    tx.set(tokenDocRef, { token, university: finalUniversity, updatedAt: serverTimestamp(), lastLoginAt: serverTimestamp() }, { merge: true });
                  });
                  prevUidRef.current = u.uid;
                  console.debug('Saved/updated FCM token for user', u.uid);
                } catch (e) {
                  console.debug('Failed to write FCM token transactionally:', e);
                }
              }
            } catch (e) {
              console.debug('FCM registration failed (non-fatal):', e);
            }
          } else {
            // user signed out - try to remove token doc for previous user
            try {
              const prevUid = prevUidRef.current;
              if (prevUid) {
                try {
                  await deleteDoc(doc(firestore, 'fcm_tokens', prevUid));
                  try { await deleteToken(messaging); } catch (e) { /* ignore */ }
                  console.debug('Removed FCM token doc for previous user', prevUid);
                } catch (e) {
                  console.debug('Failed to remove fcm_tokens doc on sign-out (non-fatal):', e);
                }
              }
            } catch (e) {
              console.debug('Error during FCM cleanup on sign-out:', e);
            }
          }
        }
      } catch (e) {
        console.debug('FCM token flow encountered an error:', e);
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

  const fastRef = user && firestore ? doc(firestore, 'users', `fast_${user.uid}`) : null;
  const nedRef = user && firestore ? doc(firestore, 'users', `ned_${user.uid}`) : null;
  const { data: fastData, loading: fastLoading, error: fastError } = useDoc<UserProfile>(fastRef);
  const { data: nedData, loading: nedLoading, error: nedError } = useDoc<UserProfile>(nedRef);

  const data = fastData || nedData || null;
  const dataLoading = (fastLoading || nedLoading);
  const error = fastError || nedError || null;

  return {
    user,
    loading: loading || (user && dataLoading),
    data,
    error,
    initialized,
  };
}
