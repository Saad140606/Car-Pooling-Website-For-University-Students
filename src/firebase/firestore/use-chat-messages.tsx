'use client';

import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { subscribeMessages } from './chats';
import { FirestorePermissionError } from '../errors';
import { errorEmitter } from '../error-emitter';

// Subscribe to top-level `chats/{chatId}/messages` to match the app's chat layout.
export function useChatMessages(db: Firestore | null, universityId: string | null, chatId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db || !chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const unsub = subscribeMessages(db, universityId as string, chatId, (items) => {
        setMessages(items);
        setLoading(false);
        setError(null);
      });

      return () => unsub && typeof unsub === 'function' ? unsub() : undefined;
    } catch (err: any) {
      console.error('Chat messages subscription error', err);
      const perm = new FirestorePermissionError({ path: `chats/${chatId}/messages`, operation: 'list', hint: 'Ensure you are a participant of this chat and that the chat exists.' });
      errorEmitter.emit('permission-error', perm);
      setError(perm);
      setLoading(false);
    }
  }, [db, chatId]);

  return { messages, loading, error };
}