// src/firebase/auth/use-user.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getPendingUniversity, clearPendingUniversity, isValidUniversity, getPendingGender, clearPendingGender, getSelectedUniversity, setSelectedUniversity } from '@/lib/university';
import { saveSession, clearSession } from '@/lib/sessionManager';
import { getAccountLockState, toFirestoreLockTimestamp } from '@/lib/accountLock';

import { useAuth, useFirestore } from '../provider';
import { useDoc } from '../firestore/use-doc';
import { UserProfile, CanonicalUserProfile } from '@/lib/types';


export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const lockCheckInProgressRef = useRef(false);
  const lastLockToastKeyRef = useRef<string | null>(null);
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
      setInitialized(true);

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

      } else if (!u) {
        // FCM registration/cleanup is handled centrally by NotificationContext + fcmTokenManager.
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  // User profile subscription via useDoc (real-time)
  // CRITICAL: Use selected university if available, else pending (from auth portal), else default to fast
  const userUniversity = user ? (getSelectedUniversity() || getPendingUniversity() || 'fast') : null;
  const userRef = user && firestore ? doc(firestore, 'universities', userUniversity || 'fast', 'users', user.uid) : null;
  const { data: userData, loading: userLoading, error: userError } = useDoc<UserProfile>(userRef);

  const data = userData || null;
  const dataLoading = userLoading;

  useEffect(() => {
    if (!auth || !firestore || !user || !data) return;
    if (lockCheckInProgressRef.current) return;

    const lockState = getAccountLockState(data);
    if (!lockState.locked || !lockState.lockUntil) return;

    lockCheckInProgressRef.current = true;
    const userUniversity = (data as any)?.university || getSelectedUniversity() || getPendingUniversity() || 'fast';

    (async () => {
      try {
        if (lockState.shouldPersistLock) {
          try {
            await updateDoc(doc(firestore, 'universities', userUniversity, 'users', user.uid), {
              accountLockUntil: toFirestoreLockTimestamp(lockState.lockUntil),
              accountLockDays: 7,
              accountLockReason: 'many_cancellations',
            });
          } catch (persistErr) {
            console.error('[useUser] Failed to persist derived account lock:', persistErr);
          }
        }

        const toastKey = `${user.uid}:${lockState.lockUntil.getTime()}`;
        if (lastLockToastKeyRef.current !== toastKey) {
          lastLockToastKeyRef.current = toastKey;
          toast({
            variant: 'destructive',
            title: 'Account Locked',
            description: lockState.message || 'Your account is locked due to multiple cancellations.',
          });
        }

        await signOut(auth);
      } catch (err) {
        console.error('[useUser] Account lock enforcement failed:', err);
      } finally {
        lockCheckInProgressRef.current = false;
      }
    })();
  }, [auth, firestore, user, data, toast]);

  return {
    user,
    // loading = auth bootstrap only; profile data hydrates in background
    loading,
    profileLoading: !!(user && dataLoading),
    data,
    error: userError,
    initialized,
  };
}
