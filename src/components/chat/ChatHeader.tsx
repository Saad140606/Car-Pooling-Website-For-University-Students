import React, { useState, useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Phone, Video, PhoneOff, X, MoreVertical, Info } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';

export default function ChatHeader({ meta, university, onStartCall, onHangup, calling }: { meta: any, university?: string, onStartCall?: (mode: 'audio'|'video') => void, onHangup?: () => void, calling?: boolean }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [providerContact, setProviderContact] = useState<string | null>(null);
  const [passengerContact, setPassengerContact] = useState<string | null>(null);
  const [fallbackOtherUser, setFallbackOtherUser] = useState<any>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Get other user's name - always show REAL name, never generic labels
  const isCurrentUserPassenger = meta?.passengerId === user?.uid;
  
  // If current user is the passenger, show provider/driver details
  // If current user is the provider/driver, show passenger details
  const otherUserDetails = isCurrentUserPassenger 
    ? (meta?.providerDetails || meta?.driverDetails) 
    : meta?.passengerDetails;

  const effectiveOtherUser = otherUserDetails || fallbackOtherUser;
  const otherUserName =
    effectiveOtherUser?.fullName ||
    effectiveOtherUser?.name ||
    meta?.otherUserName ||
    (isCurrentUserPassenger ? 'Ride Provider' : 'Passenger');
  
  const initials = otherUserName.split(' ').map((n: string) => n[0]).slice(0, 2).join('');
  const otherUserContact = isCurrentUserPassenger ? providerContact : passengerContact;

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
            if (fastSnap.exists()) {
              const data = fastSnap.data() as any;
              return data.contactNumber || data.phone || null;
            }
            const nedSnap = await getDoc(doc(firestore, 'universities', 'ned', 'users', uid));
            if (nedSnap.exists()) {
              const data = nedSnap.data() as any;
              return data.contactNumber || data.phone || null;
            }
            const khiSnap = await getDoc(doc(firestore, 'universities', 'karachi', 'users', uid));
            if (khiSnap.exists()) {
              const data = khiSnap.data() as any;
              return data.contactNumber || data.phone || null;
            }
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
    let mounted = true;
    async function fetchFallbackOtherUser() {
      if (!firestore || !user?.uid || !meta) return;
      const hasResolvedName = !!(otherUserDetails?.fullName || otherUserDetails?.name);
      if (hasResolvedName) {
        if (mounted) setFallbackOtherUser(null);
        return;
      }

      const candidateId =
        (meta?.passengerId && meta.passengerId !== user.uid && meta.passengerId) ||
        ((meta?.providerId || meta?.driverId) && (meta?.providerId || meta?.driverId) !== user.uid && (meta?.providerId || meta?.driverId)) ||
        (Array.isArray(meta?.participants)
          ? meta.participants.find((participantId: string) => participantId !== user.uid)
          : null);

      if (!candidateId) return;

      const tryUniversities = [university, meta?.university, 'fast', 'ned', 'karachi'].filter(Boolean);
      for (const uni of tryUniversities) {
        try {
          const userSnap = await getDoc(doc(firestore, 'universities', String(uni), 'users', candidateId));
          if (userSnap.exists()) {
            if (mounted) setFallbackOtherUser(userSnap.data());
            return;
          }
        } catch (_) {
          // ignore next university
        }
      }
    }

    fetchFallbackOtherUser();
    return () => { mounted = false; };
  }, [firestore, meta, user?.uid, otherUserDetails?.fullName, otherUserDetails?.name]);

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
    const num = otherUserContact || meta?.contactNumber || meta?.phone;
    if (num) {
      window.location.href = `tel:${num}`;
    } else {
      alert('No contact number available for this chat.');
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800/95 via-slate-900/95 to-slate-800/95 backdrop-blur-md border-b border-slate-700/50 shadow-lg">
      {/* Left section - User info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg ring-2 ring-slate-700">
          {initials}
        </div>
        
        {/* Name and status */}
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <UserNameWithBadge 
              name={otherUserName} 
              verified={isUserVerified(effectiveOtherUser)}
              size="md"
              truncate
            />
          </div>
          {calling ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400 animate-pulse">
              <span className="h-2 w-2 bg-green-400 rounded-full"></span>
              <span>On call</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              {meta?.bookingId ? 'Active chat' : 'Chat'}
            </div>
          )}
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {!calling ? (
          <>
            <button 
              className="p-2 sm:p-2.5 rounded-full hover:bg-primary/20 text-primary transition-all hover:scale-110 active:scale-95" 
              onClick={() => { if (onStartCall) onStartCall('audio'); }} 
              title="Start audio call"
            >
              <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button 
              className="p-2 sm:p-2.5 rounded-full hover:bg-primary/20 text-primary transition-all hover:scale-110 active:scale-95" 
              onClick={() => { if (onStartCall) onStartCall('video'); }} 
              title="Start video call"
            >
              <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </>
        ) : (
          <button 
            className="p-2 sm:p-2.5 rounded-full bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-all hover:scale-110 active:scale-95 animate-pulse" 
            onClick={() => onHangup?.()} 
            title="End call"
          >
            <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}
        
        {/* Info button */}
        <Dialog open={showInfo} onOpenChange={setShowInfo}>
          <DialogTrigger asChild>
            <button 
              className="p-2 sm:p-2.5 rounded-full hover:bg-slate-700/50 text-slate-400 transition-all hover:scale-110 active:scale-95"
              title="Chat info"
            >
              <Info className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Chat Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Name</div>
                <div className="text-white font-medium">{otherUserName}</div>
              </div>
              {meta?.bookingId && (
                <div>
                  <div className="text-slate-400 mb-1">Booking ID</div>
                  <div className="text-white font-mono text-xs break-all bg-slate-700/50 p-2 rounded">{meta.bookingId}</div>
                </div>
              )}
              {meta?.rideId && (
                <div>
                  <div className="text-slate-400 mb-1">Ride ID</div>
                  <div className="text-white font-mono text-xs break-all bg-slate-700/50 p-2 rounded">{meta.rideId}</div>
                </div>
              )}
              {otherUserContact && (
                <div>
                  <div className="text-slate-400 mb-1">Contact</div>
                  <a 
                    href={`tel:${otherUserContact}`}
                    className="text-primary hover:underline"
                  >
                    {otherUserContact}
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
