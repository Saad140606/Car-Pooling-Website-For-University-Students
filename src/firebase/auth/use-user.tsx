// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getPendingUniversity, clearPendingUniversity, isValidUniversity, getPendingGender, clearPendingGender, getSelectedUniversity, setSelectedUniversity } from '@/lib/university';
import { saveSession, clearSession } from '@/lib/sessionManager';

import { useAuth, useFirestore } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { UserProfile, CanonicalUserProfile } from '@/lib/types';


export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setInitialized(true);
      return;
    }
    const prevUidRef = { current: null as string | null };

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // PERSISTENCE: Save/clear session (fast, no await needed)
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
          // non-fatal
        }
      } else {
        clearSession();
      }

      // ── CRITICAL PERF FIX: Mark loading=false IMMEDIATELY after auth state is known ──
      // The user profile fetch (useDoc below) and FCM registration happen in the background.
      setLoading(false);
      if (!initialized) {
        setInitialized(true);
      }

      // ── Ensure user document exists (fire-and-forget, non-blocking) ──
      if (u && firestore) {
        // Run user doc creation in background - don't block rendering
        (async () => {
          try {
            let targetUniversity = getSelectedUniversity();
            if (!targetUniversity) {
              const pending = getPendingUniversity();
              if (isValidUniversity(pending)) {
                targetUniversity = pending as any;
                setSelectedUniversity(targetUniversity);
              }
            }
            if (!targetUniversity) {
              targetUniversity = 'fast';
            }

            const userRef = doc(firestore, 'universities', targetUniversity, 'users', u.uid);
            const userSnap = await getDoc(userRef).catch(() => null as any);

            if (!userSnap?.exists()) {
              if (u.emailVerified) {
                const pendingGender = getPendingGender();
                const profile: CanonicalUserProfile = {
                  uid: u.uid,
                  name: (u.displayName || '') as string,
                  email: u.email || null,
                  university: targetUniversity as 'fast' | 'ned' | 'karachi',
                  role: 'passenger',
                  createdAt: serverTimestamp() as any,
                  ...(pendingGender ? { gender: pendingGender } : {}),
                } as unknown as CanonicalUserProfile;

                try {
                  await setDoc(doc(firestore, 'universities', targetUniversity, 'users', u.uid), profile, { merge: false });
                  setSelectedUniversity(targetUniversity);
                } catch (err: any) {
                  if (process.env.NODE_ENV !== 'production') {
                    try { toast({ variant: 'destructive', title: 'User document creation failed', description: String(err?.message || err) }); } catch (_) {}
                  }
                } finally {
                  try { clearPendingUniversity(); clearPendingGender(); } catch (_) {}
                }
              }
            } else {
              const storedUni = getSelectedUniversity();
              if (!storedUni) setSelectedUniversity(targetUniversity);
            }
          } catch (err) {
            // non-fatal
          }
        })();

        // ── FCM token registration (fire-and-forget, completely non-blocking) ──
        (async () => {
          try {
            if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;
            
            // Lazy-import FCM modules to avoid loading them at startup
            const { getMessaging, getToken } = await import('firebase/messaging');
            const messaging = getMessaging();

            if ('Notification' in window) {
              const perm = await Notification.requestPermission();
              if (perm !== 'granted') return;
            }

            const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
            if (token) {
              const finalUniversity = getSelectedUniversity() || 'fast';
              const tokenDocRef = doc(firestore, 'fcm_tokens', u.uid);
              await setDoc(tokenDocRef, {
                token,
                university: finalUniversity,
                updatedAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
              }, { merge: true });
              prevUidRef.current = u.uid;
            }
          } catch (_) {
            // FCM is non-critical, silently fail
          }
        })();
      } else if (!u) {
        // User signed out - cleanup FCM (fire-and-forget)
        (async () => {
          try {
            if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || !firestore) return;
            const prevUid = prevUidRef.current;
            if (prevUid) {
              const { getMessaging, deleteToken } = await import('firebase/messaging');
              await deleteDoc(doc(firestore, 'fcm_tokens', prevUid)).catch(() => {});
              try { await deleteToken(getMessaging()); } catch (_) {}
            }
          } catch (_) {}
        })();
      }
    });

    return () => unsubscribe();
  }, [auth, initialized]);

  // User profile subscription via useDoc (real-time)
  const userUniversity = user ? (getSelectedUniversity() || 'fast') : null;
  const userRef = user && firestore ? doc(firestore, 'universities', userUniversity || 'fast', 'users', user.uid) : null;
  const { data: userData, loading: userLoading, error: userError } = useDoc<UserProfile>(userRef);

  const data = userData || null;
  const dataLoading = userLoading;

  return {
    user,
    loading: loading || (user && dataLoading),
    data,
    error: userError,
    initialized,
  };
}
