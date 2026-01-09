import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export async function sendContactMessage(endpoint: string, payload: any) {
  const res = await fetch(endpoint, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function createReport(firestore: any, doc: any) {
  return await addDoc(collection(firestore, 'reports'), { ...doc, createdAt: serverTimestamp() });
}
