// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getPendingUniversity, clearPendingUniversity, isValidUniversity, getPendingGender, clearPendingGender } from '@/lib/university';
import { saveSession, clearSession } from '@/lib/sessionManager';

import { useAuth, useFirestore } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { UserProfile, CanonicalUserProfile } from '@/lib/types';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';


export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // New state
  const { toast } = useToast();

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

      // PERSISTENCE: Save session when user logs in
      if (u) {
        try {
          saveSession({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            emailVerified: u.emailVerified,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn('[SessionManager] Failed to save session on auth state change:', err);
        }
      } else {
        // PERSISTENCE: Clear session when user logs out
        clearSession();
      }


      // Ensure a users/{university}/{uid} document exists for the signed-in user. Run once on sign-in and do not overwrite existing data.
      if (u && firestore) {
        try {
          const userFastRef = doc(firestore, 'universities', 'fast', 'users', u.uid);
          const userNedRef = doc(firestore, 'universities', 'ned', 'users', u.uid);
          const userKarachiRef = doc(firestore, 'universities', 'karachi', 'users', u.uid);
          const snapFast = await getDoc(userFastRef).catch(() => null as any);
          const snapNed = await getDoc(userNedRef).catch(() => null as any);
          const snapKarachi = await getDoc(userKarachiRef).catch(() => null as any);

          // If a profile exists in universities/*/users/*, do nothing here.
          const existsInUniversities = (snapFast && snapFast.exists()) || (snapNed && snapNed.exists()) || (snapKarachi && snapKarachi.exists());
          if (!existsInUniversities) {
            // Only create profile if email verified
            if (!u.emailVerified) {
              console.debug('User is unverified; skipping users/{university}/{uid} creation for', u.uid);
            } else {
              // Prefer pending university, otherwise fall back to 'fast'
              let universityToSet: string | null = null;
              try { universityToSet = getPendingUniversity(); } catch (err) { console.warn('Could not read pending_university from localStorage', err); }
              const finalUniversity = isValidUniversity(universityToSet) ? universityToSet as string : 'fast';
              const pendingGender = getPendingGender();
              const profile: CanonicalUserProfile = {
                uid: u.uid,
                name: (u.displayName || '') as string,
                email: u.email || null,
                university: finalUniversity as 'fast' | 'ned' | 'karachi',
                role: 'passenger',
                createdAt: serverTimestamp() as any,
                // preserve optional legacy fields when available
                ...(pendingGender ? { gender: pendingGender } : {}),
              } as unknown as CanonicalUserProfile;

              try {
                // Create canonical university-scoped user document. Use merge: false to follow canonical schema.
                await setDoc(doc(firestore, 'universities', finalUniversity, 'users', u.uid), profile, { merge: false });
                console.debug('Created canonical university-scoped users document for', u.uid, 'under', finalUniversity);
              } catch (err: any) {
                console.warn('Failed to create users/{university}/{uid} document:', err);
                if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
                  try {
                    toast({ variant: 'destructive', title: 'User document creation failed', description: String(err?.message || err) });
                  } catch (_) {}
                }
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
                const fastSnap = await getDoc(doc(firestore, 'universities', 'fast', 'users', u.uid));
                const nedSnap = await getDoc(doc(firestore, 'universities', 'ned', 'users', u.uid));
                const karachiSnap = await getDoc(doc(firestore, 'universities', 'karachi', 'users', u.uid));
                let finalUniversity = 'fast';
                if (fastSnap.exists()) finalUniversity = 'fast';
                else if (nedSnap.exists()) finalUniversity = 'ned';
                else if (karachiSnap.exists()) finalUniversity = 'karachi';

                // Update the token document per user. Use setDoc with merge instead of transaction
                // to avoid failed-precondition errors from rapid concurrent updates.
                const tokenDocRef = doc(firestore, 'fcm_tokens', u.uid);
                try {
                  await setDoc(tokenDocRef, { 
                    token, 
                    university: finalUniversity, 
                    updatedAt: serverTimestamp(), 
                    lastLoginAt: serverTimestamp() 
                  }, { merge: true });
                  prevUidRef.current = u.uid;
                  console.debug('Saved/updated FCM token for user', u.uid);
                } catch (e) {
                  console.debug('Failed to write FCM token:', e);
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

  const fastRef = user && firestore ? doc(firestore, 'universities', 'fast', 'users', user.uid) : null;
  const nedRef = user && firestore ? doc(firestore, 'universities', 'ned', 'users', user.uid) : null;
  const karachiRef = user && firestore ? doc(firestore, 'universities', 'karachi', 'users', user.uid) : null;
  const { data: fastData, loading: fastLoading, error: fastError } = useDoc<UserProfile>(fastRef);
  const { data: nedData, loading: nedLoading, error: nedError } = useDoc<UserProfile>(nedRef);
  const { data: karachiData, loading: karachiLoading, error: karachiError } = useDoc<UserProfile>(karachiRef);

  const data = fastData || nedData || karachiData || null;
  const dataLoading = (fastLoading || nedLoading || karachiLoading);
  const error = fastError || nedError || karachiError || null;

  return {
    user,
    loading: loading || (user && dataLoading),
    data,
    error,
    initialized,
  };
}
