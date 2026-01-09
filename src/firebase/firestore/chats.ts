import { collection, doc, addDoc, setDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Unified chat helpers using top-level `chats/{chatId}` and `chats/{chatId}/messages`
export function chatRef(firestore: Firestore, universityId: string, chatId: string) {
  return doc(firestore, `universities/${universityId}/chats`, chatId);
}

export function chatMessagesRef(firestore: Firestore, universityId: string, chatId: string) {
  return collection(firestore, `universities/${universityId}/chats/${chatId}/messages`);
}

// Note: chat documents must only be created atomically when a booking is accepted
// by the provider. Avoid providing ad-hoc helper functions that permit creating
// chats outside of the acceptance transaction to prevent backfills or manual
// creation for legacy bookings.

export async function sendMessage(firestore: Firestore, universityId: string, chatId: string, message: any) {
  const messages = chatMessagesRef(firestore, universityId, chatId);
  const msg = {
    senderId: message.senderId,
    type: message.type || 'text',
    content: message.content || '',
    mediaUrl: message.mediaUrl || null,
    timestamp: serverTimestamp(),
  };
  return await addDoc(messages, msg);
}
export function subscribeMessages(firestore: Firestore, universityId: string, chatId: string, onUpdate: (docs: any[]) => void) {
  const q = query(chatMessagesRef(firestore, universityId, chatId), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(items);
  }, (err: any) => {
    // Log permission or other errors locally. Do not emit a global permission
    // event here — this case can occur in normal app flows (missing chat doc,
    // not a participant) and should be surfaced locally to the chat UI instead
    // of triggering a destructive global toast.
    console.error('Chat messages onSnapshot error (suppressed global emit):', err);
  });
}