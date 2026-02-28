import { collection, doc, addDoc, setDoc, serverTimestamp, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { createNotification } from '@/firebase/firestore/notifications';

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
    seenBy: [message.senderId], // Initialize with sender's ID
  };
  
  const result = await addDoc(messages, msg);
  
  // Create chat notification for the recipient
  let recipientId = message.recipientId;
  if (!recipientId) {
    try {
      const chatSnap = await getDoc(chatRef(firestore, universityId, chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as any;
        const participants: string[] = Array.isArray(chatData?.participants)
          ? chatData.participants.filter((p: any) => typeof p === 'string')
          : [chatData?.passengerId, chatData?.providerId].filter((p: any) => typeof p === 'string');
        recipientId = participants.find((participantId) => participantId !== message.senderId);
      }
    } catch (resolveErr) {
      console.debug('Failed to resolve chat recipient from chat doc:', resolveErr);
    }
  }

  if (recipientId && recipientId !== message.senderId) {
    try {
      const normalizedType = String(message.type || 'text').toLowerCase();
      const messagePreview = normalizedType === 'voice'
        ? 'sent you a voice message'
        : normalizedType === 'image'
          ? 'sent you an image'
          : normalizedType === 'video'
            ? 'sent you a video'
            : normalizedType === 'audio'
              ? 'sent you an audio file'
              : normalizedType === 'file'
                ? 'sent you a file'
                : 'sent you a message';

      await createNotification(
        firestore,
        universityId,
        recipientId,
        'chat',
        {
          relatedRideId: message.rideId || chatId,
          relatedChatId: chatId,
          title: 'New Message',
          message: message.senderName ? `${message.senderName} ${messagePreview}` : 'You have a new message',
          metadata: {
            senderName: message.senderName,
            senderId: message.senderId,
            messageType: message.type
          }
        }
      );
    } catch (err) {
      console.error('Failed to create chat notification:', err);
    }
  }
  
  return result;
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