import { useEffect, useState, useRef, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { subscribeMessages, sendMessage as sendMsg, chatRef } from '@/firebase/firestore/chats';
import { getDoc } from 'firebase/firestore';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function useChat(chatId?: string | null, universityId?: string | null) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessible, setAccessible] = useState<boolean | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!firestore || !chatId) return;
    // Reset accessible when re-initializing subscription so stale values
    // from previous mounts/opens don't cause incorrect "access denied" UI.
    setAccessible(null);
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        if (!universityId) throw new Error('universityId required for chat subscription');
        const cref = chatRef(firestore, universityId, chatId as string);
        const snap = await getDoc(cref);
        if (!snap.exists()) {
          // Chat document missing — mark as inaccessible and avoid subscribing.
          if (mounted) {
            setAccessible(false);
            setLoading(false);
          }
          return;
        }

        const data = snap.data() as any;
        // Build a normalized participant id list to handle a few common shapes
        const participants = new Set<string>();
        try {
          // eslint-disable-next-line no-console
          console.debug('useChat: fetched chat', { chatId, chatData: data, currentUid: user?.uid });
        } catch (e) {}

        // Top-level passenger/provider fields
        if (data?.passengerId && typeof data.passengerId === 'string') participants.add(data.passengerId);
        if (data?.providerId && typeof data.providerId === 'string') participants.add(data.providerId);

        // participants array (newer shape)
        if (Array.isArray(data?.participants)) {
          for (const p of data.participants) if (typeof p === 'string') participants.add(p);
        }

        // Nested shapes (e.g., passenger: { uid: '...' } or passengerDetails.uid)
        if (data?.passenger && typeof data.passenger === 'object' && data.passenger.uid) participants.add(data.passenger.uid);
        if (data?.provider && typeof data.provider === 'object' && data.provider.uid) participants.add(data.provider.uid);
        if (data?.passengerDetails && typeof data.passengerDetails === 'object' && data.passengerDetails.uid) participants.add(data.passengerDetails.uid);
        if (data?.providerDetails && typeof data.providerDetails === 'object' && data.providerDetails.uid) participants.add(data.providerDetails.uid);

        // Debug resolved participants
        try {
          // eslint-disable-next-line no-console
          console.debug('useChat: resolved participants', { chatId, participants: Array.from(participants) });
        } catch (e) {}

        // Verify current user is a participant (passenger or provider)
        if (!user || !participants.has(user.uid)) {
          // Fallback: some legacy chat docs may omit a participants array but include a bookingId.
          // In that case verify membership by reading the booking referenced by chat.bookingId.
          let allowedViaBooking = false;
          try {
            if (data?.bookingId && typeof data.bookingId === 'string') {
              const bookingRef = doc(firestore, `universities/${universityId}/bookings`, data.bookingId);
              const bSnap = await getDoc(bookingRef);
              if (bSnap.exists()) {
                const bData = bSnap.data() as any;
                // passengerId on booking indicates the passenger; provider/driver is present on ride or chat
                if (bData?.passengerId && bData.passengerId === user.uid) allowedViaBooking = true;
                // also allow if chat explicitly names providerId and it matches the current user
                if (!allowedViaBooking && data?.providerId && data.providerId === user.uid) allowedViaBooking = true;
              }
            }
          } catch (e) {
            // ignore booking read errors — we'll fall back to denying access below
          }

          if (!allowedViaBooking) {
            try {
              // eslint-disable-next-line no-console
              console.warn('useChat: access denied for chat', { chatId, resolvedParticipants: Array.from(participants), currentUid: user?.uid });
            } catch (e) {}
            if (mounted) {
              setAccessible(false);
              setLoading(false);
            }
            return;
          }
        }

        // Safe to subscribe
        if (mounted) setAccessible(true);
        unsubRef.current = subscribeMessages(firestore, universityId as string, chatId as string, (items) => {
          if (!mounted) return;
          setMessages(items as any[]);
          setLoading(false);
        });
      } catch (err: any) {
        console.error('Failed to init chat subscription', err);
        if (mounted) {
          setAccessible(false);
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; unsubRef.current?.(); unsubRef.current = null; };
  }, [firestore, chatId, universityId, user?.uid]);

  const sendMessage = useCallback(async (payload: { type?: string; content?: string; mediaUrl?: string }) => {
    if (!firestore || !chatId || !user || accessible === false || !universityId) return null;
    return sendMsg(firestore, universityId, chatId, {
      senderId: user.uid,
      type: payload.type || 'text',
      content: payload.content || '',
      mediaUrl: payload.mediaUrl || null,
    });
  }, [firestore, chatId, user, accessible]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!firestore || !chatId || !user || !universityId) return;
    try {
      const cref = doc(firestore, `universities/${universityId}/chats`, chatId);
      await updateDoc(cref, { typing: { userId: user.uid, isTyping, at: serverTimestamp() } });
    } catch (_) {}
  }, [firestore, chatId, user, universityId]);

  return { messages, loading, sendMessage, setTyping, accessible };
}
