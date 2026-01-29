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
        const fastRef = doc(firestore, 'universities', userData.university, 'users', user.uid);
      const nedRef = doc(firestore, 'universities', userData.university, 'users', user.uid);
      const fastSnap = await getDoc(fastRef);
      const nedSnap = await getDoc(nedRef);
      if (fastSnap.exists()) append('users/fast/{uid}', fastSnap.data());
      else if (nedSnap.exists()) append('users/ned/{uid}', nedSnap.data());
      else append('users/{uid}', 'NOT FOUND');
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
          const fastRef = doc(firestore, 'universities', userData.university, 'users', user.uid);
      const nedRef = doc(firestore, 'universities', userData.university, 'users', user.uid);
      const fastSnap = await getDoc(fastRef);
      const nedSnap = await getDoc(nedRef);
      if (fastSnap.exists() || nedSnap.exists()) {
        append('createUserDoc', 'users/{university}/{uid} already exists, skipping');
        return;
      }
      const target = (userData && userData.university) ? userData.university : 'fast';
        await setDoc(doc(firestore, 'universities', target, 'users', user.uid), { email: user.email || null, university: target, createdAt: serverTimestamp() });
      append('createUserDoc', `Created universities/${target}/users/${user.uid}`);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="section-shell py-8 max-w-3xl mx-auto relative z-10">
        <div className="mb-8 animate-page">
          <h1 className="text-3xl font-headline font-bold text-slate-50 mb-2">Firestore Debug Console</h1>
          <p className="text-slate-300 text-sm">Development-only debugging page to help diagnose Firestore permission issues</p>
        </div>

        <div className="p-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-lg mb-6">
          <div className="flex gap-2 mb-4 flex-wrap animate-slide-in-down">
            <Button onClick={checkAuth} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">Check Auth</Button>
            <Button onClick={checkUserDoc} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">Check users/{`{uid}`}</Button>
            <Button onClick={createUserDoc} variant="outline" className="border-border/40" size="sm">Create users/{`{uid}`}</Button>
            <Button onClick={() => tryListRides()} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">List rides for my university</Button>
            <Button onClick={() => tryListRides('fast')} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">List rides for fast</Button>
          </div>

          <pre className="whitespace-pre-wrap bg-slate-900/60 border border-border/40 p-4 rounded-lg text-xs text-slate-200 overflow-auto max-h-96 font-mono">
            {output || 'No checks run yet.'}
          </pre>
        </div>

        <div className="p-4 rounded-xl border border-accent/25 bg-accent/5 backdrop-blur-lg">
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-accent">💡 Helpful Tip:</strong> If a permission error appears, verify that your signed-in user has a <code className="bg-slate-800/50 px-1 py-0.5 rounded text-accent">users/{'{uid}'}</code> doc and that <code className="bg-slate-800/50 px-1 py-0.5 rounded text-accent">users/{'{uid}'}.university</code> matches the university you're trying to read. See <code className="bg-slate-800/50 px-1 py-0.5 rounded text-accent">docs/firestore-rules.md</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
