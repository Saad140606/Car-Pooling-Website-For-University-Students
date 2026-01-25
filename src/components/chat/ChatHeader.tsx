import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

export default function ChatHeader({ meta, onStartCall, onHangup, calling }: { meta: any, onStartCall?: (mode: 'audio'|'video') => void, onHangup?: () => void, calling?: boolean }) {
  const firestore = useFirestore();
  const [providerContact, setProviderContact] = useState<string | null>(null);
  const [passengerContact, setPassengerContact] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchContacts() {
      if (!firestore || !meta) return;
      try {
        const providerId = meta.providerId || meta.driverId || meta.provider?.uid;
        const passengerId = meta.passengerId || meta.passenger?.uid;
        const fetchUserContact = async (uid: string) => {
          try {
            const fastSnap = await getDoc(doc(firestore, 'universities', 'fast', 'users', uid));
            if (fastSnap.exists()) return (fastSnap.data() as any).contactNumber || null;
            const nedSnap = await getDoc(doc(firestore, 'universities', 'ned', 'users', uid));
            if (nedSnap.exists()) return (nedSnap.data() as any).contactNumber || null;
          } catch (_) { /* ignore */ }
          return null;
        };

        if (providerId) {
          try {
            const contact = await fetchUserContact(providerId);
            if (mounted) setProviderContact(contact);
          } catch (_) { /* ignore */ }
        }
        if (passengerId) {
          try {
            const contact = await fetchUserContact(passengerId);
            if (mounted) setPassengerContact(contact);
          } catch (_) { /* ignore */ }
        }
      } catch (e) {
        // non-fatal
      }
    }
    fetchContacts();
    return () => { mounted = false; };
  }, [firestore, meta]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!showVideoPreview) return () => {};
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.warn('Could not start local camera preview', e);
      }
    })();
    return () => {
      try { if (videoRef.current) videoRef.current.srcObject = null; } catch (_) {}
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [showVideoPreview]);

  const phoneClick = () => {
    // Prefer provider contact, otherwise passenger
    const num = providerContact || passengerContact || meta?.contactNumber || meta?.phone;
    if (num) {
      window.location.href = `tel:${num}`;
    } else {
      alert('No contact number available for this chat.');
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-border bg-card">
      <div>
        <div className="font-semibold">Chat</div>
        <div className="text-xs text-muted-foreground">{meta?.bookingId ? `Booking: ${meta.bookingId}` : 'Chat'}</div>
      </div>
      <div className="flex items-center gap-2">
        {!calling ? (
          <>
            <button className="p-2 rounded-md hover:bg-white/5" onClick={() => { if (onStartCall) onStartCall('audio'); }} title="Start audio call">📞</button>
            <button className="p-2 rounded-md hover:bg-white/5" onClick={() => { if (onStartCall) onStartCall('video'); }} title="Start video call">🎥</button>
          </>
        ) : (
          <button className="p-2 rounded-md hover:bg-red-600 text-red-500" onClick={() => onHangup?.()} title="End call">🛑</button>
        )}
      </div>
    </div>
  );
}
