import { useEffect, useState, useRef, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { subscribeMessages, sendMessage as sendMsg, chatRef } from '@/firebase/firestore/chats';
import { getDoc, getDocs, query, collection, where, writeBatch, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useNotifications } from '@/contexts/NotificationContext';

// Helper function to mark messages as seen
async function markMessagesAsSeen(firestore: any, universityId: string, chatId: string, userId: string, messages: any[]) {
  try {
    const batch = writeBatch(firestore);
    const messagesRef = collection(firestore, `universities/${universityId}/chats/${chatId}/messages`);
    
    // Find messages not sent by current user and not yet seen by them
    const unseenMessages = messages.filter((msg: any) => 
      msg.senderId !== userId && 
      (!msg.seenBy || !msg.seenBy.includes(userId))
    );
    
    if (unseenMessages.length === 0) return;
    
    // Update each unseen message
    unseenMessages.forEach((msg: any) => {
      const msgRef = doc(messagesRef, msg.id);
      const currentSeenBy = msg.seenBy || [];
      batch.update(msgRef, {
        seenBy: [...currentSeenBy, userId]
      });
    });
    
    await batch.commit();
  } catch (err) {
    console.error('Failed to mark messages as seen:', err);
  }
}

export function useChat(chatId?: string | null, universityId?: string | null) {
  const firestore = useFirestore();
  const { user } = useUser();
  const normalizedUniversityId = String(universityId || '').trim().toLowerCase();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessible, setAccessible] = useState<boolean | null>(null);
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(null);
  const [resolvedRecipientId, setResolvedRecipientId] = useState<string | null>(null);
  const [resolvedRideId, setResolvedRideId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!firestore || !chatId) return;
    // Reset accessible when re-initializing subscription so stale values
    // from previous mounts/opens don't cause incorrect "access denied" UI.
    setAccessible(null);
    setResolvedChatId(chatId || null);
    setResolvedRecipientId(null);
    setResolvedRideId(null);
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        if (!normalizedUniversityId) throw new Error('universityId required for chat subscription');
        const normalizeParticipants = (chatData: any): string[] => {
          const participants = new Set<string>();
          if (chatData?.passengerId && typeof chatData.passengerId === 'string') participants.add(chatData.passengerId);
          if (chatData?.providerId && typeof chatData.providerId === 'string') participants.add(chatData.providerId);
          if (chatData?.driverId && typeof chatData.driverId === 'string') participants.add(chatData.driverId);
          if (Array.isArray(chatData?.participants)) {
            for (const participantId of chatData.participants) {
              if (typeof participantId === 'string') participants.add(participantId);
            }
          }
          if (chatData?.passenger?.uid && typeof chatData.passenger.uid === 'string') participants.add(chatData.passenger.uid);
          if (chatData?.provider?.uid && typeof chatData.provider.uid === 'string') participants.add(chatData.provider.uid);
          if (chatData?.passengerDetails?.uid && typeof chatData.passengerDetails.uid === 'string') participants.add(chatData.passengerDetails.uid);
          if (chatData?.providerDetails?.uid && typeof chatData.providerDetails.uid === 'string') participants.add(chatData.providerDetails.uid);
          return Array.from(participants);
        };

        const tryResolveChatByBooking = async (): Promise<{ id: string; data: any } | null> => {
          if (!chatId) return null;
          try {
            const byBookingQuery = query(
              collection(firestore, `universities/${normalizedUniversityId}/chats`),
              where('bookingId', '==', chatId)
            );
            const byBookingSnap = await getDocs(byBookingQuery);
            for (const candidate of byBookingSnap.docs) {
              const candidateData = candidate.data() as any;
              const candidateParticipants = normalizeParticipants(candidateData);
              if (!user?.uid || candidateParticipants.includes(user.uid)) {
                return { id: candidate.id, data: candidateData };
              }
            }
          } catch (resolveErr) {
            console.debug('useChat: booking chat resolve failed', resolveErr);
          }
          return null;
        };

        const bootstrapChatFromBooking = async (): Promise<{ id: string; data: any } | null> => {
          if (!chatId || !user?.uid) return null;
          try {
            const bookingRef = doc(firestore, `universities/${normalizedUniversityId}/bookings`, chatId);
            const bookingSnap = await getDoc(bookingRef);
            if (!bookingSnap.exists()) return null;
            const bookingData = bookingSnap.data() as any;
            const passengerId = bookingData?.passengerId;
            const providerId = bookingData?.driverId || bookingData?.providerId;
            if (!passengerId || !providerId) return null;
            if (user.uid !== passengerId && user.uid !== providerId) return null;

            const payload = {
              bookingId: chatId,
              rideId: bookingData?.rideId || null,
              passengerId,
              providerId,
              participants: [passengerId, providerId],
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            const newChatRef = chatRef(firestore, normalizedUniversityId, chatId);
            await setDoc(newChatRef, payload, { merge: true });
            return { id: chatId, data: payload };
          } catch (bootstrapErr) {
            console.debug('useChat: bootstrap chat from booking failed', bootstrapErr);
            return null;
          }
        };

        const bootstrapChatFromRequest = async (): Promise<{ id: string; data: any } | null> => {
          if (!chatId || !user?.uid) return null;
          try {
            const separatorIndex = chatId.indexOf('_');
            if (separatorIndex <= 0) return null;
            const rideId = chatId.slice(0, separatorIndex);
            if (!rideId) return null;

            const requestRef = doc(firestore, `universities/${normalizedUniversityId}/rides/${rideId}/requests`, chatId);
            const requestSnap = await getDoc(requestRef);
            if (!requestSnap.exists()) return null;
            const requestData = requestSnap.data() as any;

            const passengerId = requestData?.passengerId;
            const providerId = requestData?.driverId || requestData?.providerId;
            if (!passengerId || !providerId) return null;
            if (user.uid !== passengerId && user.uid !== providerId) return null;

            const payload = {
              bookingId: chatId,
              rideId,
              passengerId,
              providerId,
              participants: [passengerId, providerId],
              passengerDetails: requestData?.passengerDetails || null,
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            const newChatRef = chatRef(firestore, normalizedUniversityId, chatId);
            await setDoc(newChatRef, payload, { merge: true });
            return { id: chatId, data: payload };
          } catch (bootstrapErr) {
            console.debug('useChat: bootstrap chat from request failed', bootstrapErr);
            return null;
          }
        };

        let targetChatId = chatId as string;
        let data: any = null;

        try {
          const cref = chatRef(firestore, normalizedUniversityId, targetChatId);
          const snap = await getDoc(cref);
          if (snap.exists()) {
            data = snap.data() as any;
          }
        } catch (primaryErr) {
          console.debug('useChat: primary chat fetch failed', primaryErr);
        }

        if (!data) {
          const resolved = await tryResolveChatByBooking();
          if (resolved) {
            targetChatId = resolved.id;
            data = resolved.data;
          }
        }

        if (!data) {
          const bootstrapped = await bootstrapChatFromBooking();
          if (bootstrapped) {
            targetChatId = bootstrapped.id;
            data = bootstrapped.data;
          }
        }

        if (!data) {
          const fromRequest = await bootstrapChatFromRequest();
          if (fromRequest) {
            targetChatId = fromRequest.id;
            data = fromRequest.data;
          }
        }

        if (!data) {
          if (mounted) {
            setAccessible(false);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setResolvedChatId(targetChatId);
        }

        const derivedRideId =
          (typeof data?.rideId === 'string' && data.rideId) ||
          (typeof data?.bookingId === 'string' && data.bookingId) ||
          chatId ||
          null;
        if (mounted) {
          setResolvedRideId(derivedRideId);
        }

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

        if (user?.uid) {
          const otherParticipant = Array.from(participants).find((participantId) => participantId !== user.uid) || null;
          if (mounted) {
            setResolvedRecipientId(otherParticipant);
          }
        }

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
          let allowedViaRequest = false;
          try {
            if (data?.bookingId && typeof data.bookingId === 'string') {
              const bookingRef = doc(firestore, `universities/${normalizedUniversityId}/bookings`, data.bookingId);
              const bSnap = await getDoc(bookingRef);
              if (bSnap.exists()) {
                const bData = bSnap.data() as any;
                // passengerId on booking indicates the passenger; provider/driver is present on ride or chat
                if (bData?.passengerId && bData.passengerId === user.uid) allowedViaBooking = true;
                if (!allowedViaBooking && bData?.driverId && bData.driverId === user.uid) allowedViaBooking = true;
                // also allow if chat explicitly names providerId and it matches the current user
                if (!allowedViaBooking && data?.providerId && data.providerId === user.uid) allowedViaBooking = true;
              }

              if (!allowedViaBooking) {
                const separatorIndex = data.bookingId.indexOf('_');
                if (separatorIndex > 0) {
                  const rideId = data.bookingId.slice(0, separatorIndex);
                  const reqRef = doc(firestore, `universities/${normalizedUniversityId}/rides/${rideId}/requests`, data.bookingId);
                  const reqSnap = await getDoc(reqRef);
                  if (reqSnap.exists()) {
                    const reqData = reqSnap.data() as any;
                    if (reqData?.passengerId === user.uid || reqData?.driverId === user.uid || reqData?.providerId === user.uid) {
                      allowedViaRequest = true;
                    }
                  }
                }
              }
            }
          } catch (e) {
            // ignore booking read errors — we'll fall back to denying access below
          }

          if (!allowedViaBooking && !allowedViaRequest) {
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
        unsubRef.current = subscribeMessages(firestore, normalizedUniversityId, targetChatId, (items) => {
          if (!mounted) return;
          setMessages(items as any[]);
          setLoading(false);
          
          // Mark messages as seen by current user
          if (user?.uid) {
            markMessagesAsSeen(firestore, normalizedUniversityId, targetChatId, user.uid, items);
          }
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
  }, [firestore, chatId, normalizedUniversityId, user?.uid]);

  const sendMessage = useCallback(async (payload: { type?: string; content?: string; mediaUrl?: string; recipientId?: string; rideId?: string; senderName?: string }) => {
    const activeChatId = resolvedChatId || chatId;
    if (!firestore || !activeChatId || !user || accessible === false || !normalizedUniversityId) return null;

    const recipientId = payload.recipientId || resolvedRecipientId || undefined;
    const rideId = payload.rideId || resolvedRideId || undefined;
    const senderName = payload.senderName || user.displayName || undefined;

    return sendMsg(firestore, normalizedUniversityId, activeChatId, {
      senderId: user.uid,
      type: payload.type || 'text',
      content: payload.content || '',
      mediaUrl: payload.mediaUrl || null,
      recipientId,
      rideId,
      senderName
    });
  }, [firestore, chatId, resolvedChatId, user, accessible, normalizedUniversityId, resolvedRecipientId, resolvedRideId]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    const activeChatId = resolvedChatId || chatId;
    if (!firestore || !activeChatId || !user || !normalizedUniversityId) return;
    try {
      const cref = doc(firestore, `universities/${normalizedUniversityId}/chats`, activeChatId);
      await updateDoc(cref, { typing: { userId: user.uid, isTyping, at: serverTimestamp() } });
    } catch (_) {}
  }, [firestore, chatId, resolvedChatId, user, normalizedUniversityId]);

  return {
    messages,
    loading,
    sendMessage,
    setTyping,
    accessible,
    resolvedChatId,
    resolvedRecipientId,
    resolvedRideId,
  };
}
