import React, { useEffect, useRef, useState } from 'react';
import { useChat } from './useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, deleteDoc } from 'firebase/firestore';

export default function ChatRoom({ chatId, university }: { chatId: string, university: string }) {
  const { messages, loading, sendMessage, setTyping, accessible } = useChat(chatId, university);
  const { user } = useUser();
  const firestore = useFirestore();
  const [meta, setMeta] = useState<any>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall] = useState(false);
  const callDocRef = useRef<any>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);

  const getIceServers = () => {
    const servers: any[] = [ { urls: 'stun:stun.l.google.com:19302' } ];
    try {
      const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
      const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
      const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
      if (turnUrl) {
        const turnEntry: any = { urls: turnUrl.split(',').map((s: string) => s.trim()) };
        if (turnUser) turnEntry.username = turnUser;
        if (turnCred) turnEntry.credential = turnCred;
        servers.push(turnEntry);
      }
    } catch (_) {}
    return servers;
  };

  const playRingtone = () => {
    try {
      // Use WebAudio oscillator for a lightweight ringtone; return a stop handle
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 520;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.value = 0.001;
      let on = true;
      const tick = () => {
        if (!on) return;
        // short pulse
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        g.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      };
      o.start();
      const iv = window.setInterval(tick, 700);
      // start immediately
      tick();
      ringtoneRef.current = { stop: () => { on = false; try { window.clearInterval(iv); o.stop(); ctx.close().catch(()=>{}); } catch(_){} } };
      // vibrate pattern
      if (navigator.vibrate) {
        try {
          navigator.vibrate([300,150,300]);
          const vid = window.setInterval(() => { try { navigator.vibrate([300,150,300]); } catch(_){} }, 1200) as unknown as number;
          vibrateIntervalRef.current = vid;
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Ringtone failed', e);
    }
  };

  const stopRingtone = () => {
    try {
      if (ringtoneRef.current) { try { ringtoneRef.current.stop(); } catch(_){} ringtoneRef.current = null; }
    } catch (_) {}
    try { if (vibrateIntervalRef.current) { clearInterval(vibrateIntervalRef.current); vibrateIntervalRef.current = null; navigator.vibrate(0); } } catch(_){}
  };

  useEffect(() => {
    if (!firestore) return;
    const cref = doc(firestore, `universities/${university}/chats`, chatId);
    getDoc(cref).then(s => { if (s.exists()) setMeta(s.data()); }).catch((err) => {
      // Surface meta fetch errors for debugging (do not show sensitive details in production)
      try { console.error('ChatRoom: failed to fetch chat meta', err); } catch (e) {}
      setMetaError(String(err?.message || err));
    });
  }, [firestore, chatId]);

  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  // Listen for incoming call signals on `universities/{university}/calls/{chatId}`
  useEffect(() => {
    if (!firestore) return;
    const cdoc = doc(firestore, `universities/${university}/calls`, chatId);
    callDocRef.current = cdoc;
    const unsub = onSnapshot(cdoc, async (snap) => {
      if (!snap.exists()) {
        setIncomingCall(null);
        return;
      }
      const data = snap.data();
      // If there's an offer and we're not already in a call, show incoming ringing UI
      if (data.offer && !inCall) {
        setIncomingCall({ caller: data.caller, mode: data.mode || 'audio' });
        // play ringtone & vibrate
        playRingtone();
      }
    }, (err) => {
      // ignore
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, university, chatId, inCall]);

  // Helper: cleanup call resources
  const cleanupCall = async () => {
    try {
      if (pcRef.current) {
        try {
          const maybeCleanup = (pcRef.current as any).__cleanup;
          if (maybeCleanup) await maybeCleanup();
        } catch (_) {}
        try { pcRef.current.getSenders().forEach(s => { try { if (s.track) s.track.stop(); } catch (_) {} }); } catch (_) {}
        try { pcRef.current.close(); } catch (_) {}
        pcRef.current = null;
      }
    } catch (_) {}
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    } catch (_) {}
    setRemoteStream(null);
    setInCall(false);
    stopRingtone();
    try {
      if (callDocRef.current) {
        // remove call doc to signal hangup
        await deleteDoc(callDocRef.current);
      }
    } catch (_) {}
  };

  const startCall = async (mode: 'audio'|'video') => {
    if (!firestore || !user) return;
    if (inCall) return;
    setInCall(true);
    const cdoc = doc(firestore, `universities/${university}/calls`, chatId);
    callDocRef.current = cdoc;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;

    // local stream
    let stream: MediaStream | null = null;
    try {
      const constraints: any = { audio: true }; if (mode === 'video') constraints.video = true;
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      // Ensure pc is not closed before adding tracks
      if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting' && pc.connectionState !== 'connected') {
        console.warn('PC closed before adding local tracks');
        setInCall(false);
        await cleanupCall();
        return;
      }
      stream.getTracks().forEach(track => {
        try {
          if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting' && pc.connectionState !== 'connected') throw new Error('pc not usable');
          pc.addTrack(track, stream as MediaStream);
        } catch (e) {
          console.warn('failed to add track', e);
        }
      });
    } catch (e) {
      console.error('getUserMedia failed', e);
      setInCall(false);
      await cleanupCall();
      return;
    }

    // remote stream
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // ICE candidates
    const callerCandidatesCollection = collection(cdoc, 'callerCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        try { addDoc(callerCandidatesCollection, event.candidate.toJSON()); } catch (e) { console.warn(e); }
      }
    };

    // create offer
    try {
      if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting' && pc.connectionState !== 'connected') {
        console.warn('PC closed before creating offer');
        setInCall(false);
        await cleanupCall();
        return;
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // write offer to firestore
      try {
        // Determine callee from chat meta if available (participants or explicit fields)
        let calleeId: string | null = null;
        try {
          if (meta?.participants && Array.isArray(meta.participants)) {
            const others = meta.participants.filter((p: string) => p !== user.uid);
            if (others.length > 0) calleeId = others[0];
          } else if (meta?.passengerId && meta?.providerId) {
            calleeId = meta.passengerId === user.uid ? meta.providerId : meta.passengerId;
          }
        } catch (_) {}
        await setDoc(cdoc, { offer: { type: offer.type, sdp: offer.sdp }, caller: user.uid, callee: calleeId, mode, createdAt: Date.now() });
      } catch (e) { console.warn('failed to set call doc', e); }
    } catch (e) {
      console.warn('offer creation failed', e);
      setInCall(false);
      await cleanupCall();
      return;
    }


    // Listen for answer
    const unsubAnswer = onSnapshot(cdoc, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.answer && pc && !pc.currentRemoteDescription) {
        const answer = new RTCSessionDescription(data.answer);
        try { await pc.setRemoteDescription(answer); } catch (e) { console.warn(e); }
      }
    }, (err) => {
      console.warn('Call answer snapshot error', err);
      cleanupCall().catch(()=>{});
    });

    // Listen for callee ICE candidates
    const calleeCandidatesCol = collection(cdoc, 'calleeCandidates');
    const unsubCallee = onSnapshot(calleeCandidatesCol, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          try { pc.addIceCandidate(new RTCIceCandidate(data)); } catch (e) { console.warn(e); }
        }
      });
    }, (err) => {
      console.warn('Callee candidates snapshot error', err);
    });

    // Keep these unsubscribers stored on the pc for cleanup
    (pc as any).__cleanup = async () => { unsubAnswer(); unsubCallee(); };
  };

  const answerCall = async () => {
    if (!firestore || !user) return;
    const cdoc = doc(firestore, `universities/${university}/calls`, chatId);
    const snap = await getDoc(cdoc);
    if (!snap.exists()) return;
    const data: any = snap.data();
    if (!data.offer) return;
    setInCall(true);
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;

    // get local stream (audio/video as preferred by caller mode)
    let stream: MediaStream | null = null;
    try {
      const constraints: any = { audio: true }; if (data.mode === 'video') constraints.video = true;
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting' && pc.connectionState !== 'connected') {
        console.warn('PC closed before adding local tracks (answer)');
        setInCall(false);
        await cleanupCall();
        return;
      }
      stream.getTracks().forEach(track => {
        try {
          if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting' && pc.connectionState !== 'connected') throw new Error('pc not usable');
          pc.addTrack(track, stream as MediaStream);
        } catch (e) {
          console.warn('failed to add track (answer)', e);
        }
      });
    } catch (e) {
      console.error('getUserMedia failed', e);
      setInCall(false);
      await cleanupCall();
      return;
    }

    pc.ontrack = (event) => setRemoteStream(event.streams[0]);

    const calleeCandidatesCollection = collection(cdoc, 'calleeCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) addDoc(calleeCandidatesCollection, event.candidate.toJSON()).catch(()=>{});
    };

    // set remote desc from offer
    const offer = data.offer;
    try { await pc.setRemoteDescription(new RTCSessionDescription(offer)); } catch (e) { console.warn(e); }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // write answer
    try { await setDoc(cdoc, { answer: { type: answer.type, sdp: answer.sdp }, callee: user.uid }, { merge: true }); } catch (e) { console.warn(e); }

    // listen for caller candidates
    const callerCandidatesCol = collection(cdoc, 'callerCandidates');
    const unsubCaller = onSnapshot(callerCandidatesCol, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          try { pc.addIceCandidate(new RTCIceCandidate(data)); } catch (e) { console.warn(e); }
        }
      });
    }, (err) => {
      console.warn('Caller candidates snapshot error', err);
    });

    (pc as any).__cleanup = async () => { unsubCaller(); };
  };

  const hangup = async () => {
    await cleanupCall();
  };

  // autoscroll to bottom when messages change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (accessible === false) {
    return (
      <div className="flex flex-col h-[40vh] items-center justify-center text-center p-6">
        <ChatHeader meta={meta} />
        <div className="text-sm text-muted-foreground">Chat unavailable. Ensure you are a participant and the chat exists.</div>
        <div className="text-xs text-slate-400 mt-4">
          <div>Debug info:</div>
          <div>Current UID: {user?.uid ?? 'not-signed-in'}</div>
          <div>Chat meta fetch error: {metaError ?? 'none'}</div>
          <div className="truncate">Chat id: {chatId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh] sm:h-[75vh] md:h-[70vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
      <ChatHeader meta={meta} onStartCall={(mode) => startCall(mode)} onHangup={() => hangup()} calling={inCall} />
      
      {/* Hidden audio element for local/remote streams */}
      <audio autoPlay ref={(el) => { if (el && remoteStream) { try { el.srcObject = remoteStream; } catch (_) {} } }} />
      
      {/* Messages area with gradient background */}
      <div className="relative flex-1 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </div>
        
        <div ref={listRef} className="relative h-full overflow-auto p-3 sm:p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-sm text-slate-400 animate-pulse">Loading messages...</div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2 animate-in fade-in duration-500">
                <div className="text-4xl mb-2">💬</div>
                <div className="text-sm text-slate-400">No messages yet</div>
                <div className="text-xs text-slate-500">Start the conversation!</div>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const senderName = m.senderId !== user?.uid ? (meta?.passengerDetails?.fullName || meta?.providerDetails?.fullName || meta?.driverDetails?.fullName || 'Student') : null;
              const initials = senderName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?';
              return (
                <MessageBubble 
                  key={m.id} 
                  message={m} 
                  isOwn={m.senderId === user?.uid}
                  senderName={senderName}
                  senderInitials={initials}
                />
              );
            })
          )}
        </div>
      </div>
      
      {/* Incoming call overlay */}
      {incomingCall && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 backdrop-blur-sm bg-black/50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-2xl pointer-events-auto flex flex-col sm:flex-row items-center gap-6 mx-4 max-w-md border border-slate-700 animate-in zoom-in duration-300">
            <div className="text-center sm:text-left space-y-2">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xl font-bold mx-auto sm:mx-0 animate-pulse">
                📞
              </div>
              <div className="font-semibold text-xl">Incoming {incomingCall.mode} call</div>
              <div className="text-sm text-slate-300">From: {incomingCall.caller}</div>
            </div>
            <div className="flex gap-3">
              <button 
                className="px-6 py-3 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg" 
                onClick={async () => { setIncomingCall(null); await answerCall(); }}
              >
                Accept
              </button>
              <button 
                className="px-6 py-3 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg" 
                onClick={async () => { setIncomingCall(null); try { if (callDocRef.current) await deleteDoc(callDocRef.current); } catch(_) {} }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Input area */}
      <div className="p-3 sm:p-4 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-md border-t border-slate-700/50">
        <MessageInput 
          onSend={async (text) => await sendMessage({ type: 'text', content: text })} 
          onTyping={(v) => setTyping(Boolean(v))} 
          onSendMedia={async (mediaUrl, type) => await sendMessage({ type, mediaUrl })}
          onSendVoice={async (mediaUrl) => await sendMessage({ type: 'audio', mediaUrl })}
          disabled={meta?.status !== 'active' || accessible !== true} 
        />
      </div>
    </div>
  );
}
