"use client";
import { collection as fbCollection } from 'firebase/firestore';
import { initializeFirebase } from './init';

export function ensureFirestore() {
  const inst = initializeFirebase();
  if (!inst.firestore) {
    const err = new Error('Firestore not initialized. Ensure FirebaseClientProvider is mounted and initialization succeeded.');
    // Attach helpful debugging info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).hint = { windowFirestore: (typeof window !== 'undefined') ? (window as any).firebaseFirestore : undefined };
    throw err;
  }
  return inst.firestore;
}

// A thin wrapper around `collection()` that validates the first argument and
// throws a clear error with debugging hints if Firestore is missing.
export function safeCollection(...args: Parameters<typeof fbCollection>) {
  const first = args[0];
  if (!first) {
    const fs = (typeof window !== 'undefined') ? (window as any).firebaseFirestore : undefined;
    const err = new Error('Invalid first argument to collection(): Firestore instance is missing or undefined.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).hint = { firstArg: first, windowFirestore: fs };
    throw err;
  }
  return fbCollection(...args);
}

export default safeCollection;
