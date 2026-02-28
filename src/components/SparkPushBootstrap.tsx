'use client';

import { useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { registerSparkPush } from '@/lib/sparkPushClient';

export function SparkPushBootstrap() {
  const firestore = useFirestore();
  const { user } = useUser();

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
      vapidKey,
    }).catch((error) => {
      console.warn('[SparkPushBootstrap] Push registration failed:', error);
    });
  }, [firestore, user?.uid]);

  return null;
}
