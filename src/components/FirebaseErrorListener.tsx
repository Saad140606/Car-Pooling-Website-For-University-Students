// src/components/FirebaseErrorListener.tsx
'use client';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: any) => {
      // Prefer showing a user-friendly toast instead of crashing the app
      if (error instanceof FirestorePermissionError) {
        console.warn('Firestore permission error emitted:', error);
        toast({ variant: 'destructive', title: 'Missing or insufficient permissions', description: error.hint || 'Please check your Firebase security rules. See docs/firestore-rules.md.' });
        return;
      }

      // For other errors, log and optionally show a generic toast
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
