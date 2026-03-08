'use client';

import { useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { registerSparkPush } from '@/lib/sparkPushClient';
import { getSelectedUniversity } from '@/lib/university';

export function SparkPushBootstrap() {
  const firestore = useFirestore();
  const { user, data: userData } = useUser();

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
    if (!vapidKey) {
      console.warn('[SparkPushBootstrap] Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY');
      return;
    }

    registerSparkPush({
      firestore,
      uid: user.uid,
      university: String((userData as any)?.university || getSelectedUniversity() || 'fast').trim().toLowerCase(),
      vapidKey,
    }).catch((error) => {
      console.warn('[SparkPushBootstrap] Push registration failed:', error);
    });
  }, [firestore, user?.uid, userData]);

  return null;
}
