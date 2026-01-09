'use client';

import React, { useState } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';

export default function FirestoreDebugPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, data: userData, initialized } = useUser();

  const [output, setOutput] = useState<string>('');

  const append = (label: string, value: any) => {
    setOutput((s) => `${s}\n=== ${label} ===\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
  };

  const checkAuth = () => {
    append('Auth.currentUser', auth?.currentUser || null);
    append('useUser.user', user || null);
    append('useUser.userData', userData || null);
    append('initialized', initialized);
    append('firestore', !!firestore);
  };

  const checkUserDoc = async () => {
    if (!firestore || !user) {
      append('checkUserDoc', 'Missing firestore or user (not signed in)');
      return;
    }
    try {
      const ref = doc(firestore, 'users', user.uid);
      const snap = await getDoc(ref);
      append('users/{uid}', snap.exists() ? snap.data() : 'NOT FOUND');
    } catch (err: any) {
      append('checkUserDoc.error', { message: err?.message || String(err), code: err?.code || null });
    }
  };

  const createUserDoc = async () => {
    if (!firestore || !user) {
      append('createUserDoc', 'Missing firestore or user (not signed in)');
      return;
    }

    try {
      const ref = doc(firestore, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        append('createUserDoc', 'users/{uid} already exists, skipping');
        return;
      }
      await setDoc(ref, { email: user.email || null, university: 'fast', createdAt: serverTimestamp() });
      append('createUserDoc', 'Created users/{uid}');
    } catch (err: any) {
      append('createUserDoc.error', { message: err?.message || String(err), code: err?.code || null });
    }
  };

  const tryListRides = async (univId?: string) => {
    const id = univId || (userData && userData.university) || 'fast';
    if (!firestore) { append('listRides', 'Firestore not initialized'); return; }
    try {
      const q = query(collection(firestore, 'universities', id, 'rides'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      append(`rides/${id}`, snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))); 
    } catch (err: any) {
      append('listRides.error', { message: err?.message || String(err), code: err?.code || null });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Firestore Debug</h1>
      <p className="mb-4 text-sm text-muted-foreground">This is a development-only debugging page to help diagnose Firestore permission issues.</p>

      <div className="flex gap-2 mb-4">
        <Button onClick={checkAuth}>Check Auth</Button>
        <Button onClick={checkUserDoc}>Check users/{`{uid}`}</Button>
        <Button onClick={createUserDoc} variant="outline">Create users/{`{uid}`}</Button>
        <Button onClick={() => tryListRides()}>List rides for my university</Button>
        <Button onClick={() => tryListRides('fast')}>List rides for fast</Button>
      </div>

      <pre className="whitespace-pre-wrap bg-surface/60 p-4 rounded-md text-sm overflow-auto max-h-96">
        {output || 'No checks run yet.'}
      </pre>

      <div className="mt-4 text-xs text-muted-foreground">Helpful: If a permission error appears, verify that your signed-in user has a <code>users/{'{uid}'}</code> doc and that <code>users/{'{uid}'}.university</code> matches the university you're trying to read. See <code>docs/firestore-rules.md</code>.</div>
    </div>
  );
}
