// src/components/FirebaseErrorListener.tsx
'use client';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getPendingUniversity, getPendingGender, clearPendingUniversity, clearPendingGender, getSelectedUniversity, isValidUniversity } from '@/lib/university';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = async (error: any) => {
      // For permission errors, avoid alarming destructive toasts for end users.
      if (error instanceof FirestorePermissionError) {
        console.warn('Firestore permission error emitted:', error);

        // Try an automatic remediation when a signed-in user lacks a profile.
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            const firestore = getFirestore();
            const fastRef = doc(firestore, 'users', `fast_${user.uid}`);
            const nedRef = doc(firestore, 'users', `ned_${user.uid}`);
            const fastSnap = await getDoc(fastRef);
            const nedSnap = await getDoc(nedRef);
            if (!fastSnap.exists() && !nedSnap.exists()) {
              // Build profile using pending values or selected portal
              let finalUniversity = getSelectedUniversity() || undefined;
              try { const pending = getPendingUniversity(); if (isValidUniversity(pending)) finalUniversity = pending; } catch (_) {}
              const pendingGender = (() => { try { return getPendingGender(); } catch (_) { return null; } })();

              const profile: any = { email: user.email || null, createdAt: serverTimestamp() };
              if (finalUniversity) profile.university = finalUniversity;
              if (pendingGender) profile.gender = pendingGender;

              await setDoc(doc(firestore, 'users', `${finalUniversity}_${user.uid}`), profile);
              try { clearPendingUniversity(); clearPendingGender(); } catch (_) {}
              console.debug('Auto-created missing users/{uid} after permission error for', user.uid);
              // Gentle toast asking user to refresh or retry
              toast({ variant: 'default', title: 'Account setup completed', description: 'Your account was provisioned — reload or try again to continue.' });
              return;
            }
          }
        } catch (e) {
          console.debug('Auto-remediation attempt failed:', e);
        }

        // If no remediation applied, show a non-destructive informational toast.
        toast({ variant: 'default', title: 'Content unavailable', description: error.hint || 'Some content is temporarily unavailable. Please try again shortly.' });
        return;
      }

      // For other errors, log and show a generic destructive toast
      console.error('Firebase error emitted:', error);
      toast({ variant: 'destructive', title: 'An error occurred', description: String(error?.message || error) });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
