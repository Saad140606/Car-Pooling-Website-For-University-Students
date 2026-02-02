import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callMode, setCallMode] = useState<'audio' | 'video' | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const callDocRef = useRef<any>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callUnsubsRef = useRef<Array<() => void>>([]);

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
    if (audioRef.current && remoteStream) {
      try { (audioRef.current as any).srcObject = remoteStream; } catch (_) {}
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      try { (localVideoRef.current as any).srcObject = localStream; } catch (_) {}
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      try { (remoteVideoRef.current as any).srcObject = remoteStream; } catch (_) {}
    }
  }, [remoteStream]);

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
        stopRingtone();
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

  const handleMediaError = (error: any) => {
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setCallError('Microphone or camera permission denied. Please allow access in your browser settings.');
    } else if (name === 'NotFoundError') {
      setCallError('No microphone or camera found. Please connect a device and try again.');
    } else if (name === 'NotReadableError') {
      setCallError('Your microphone or camera is currently in use by another app.');
    } else {
      setCallError('Unable to access microphone/camera. Please try again.');
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff(prev => !prev);
  };

  // Helper: cleanup call resources
  const cleanupCall = async () => {
    try {
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      // Clear subscriptions
      if (callUnsubsRef.current.length > 0) {
        callUnsubsRef.current.forEach(unsub => {
          try { unsub(); } catch (_) {}
        });
        callUnsubsRef.current = [];
      }
      
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
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    setCallMode(null);
    setIsConnecting(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallError(null);
    stopRingtone();
    try {
      if (callDocRef.current) {
        try { await setDoc(callDocRef.current, { status: 'ended', endedAt: Date.now() }, { merge: true }); } catch (_) {}
        // remove call doc to signal hangup
        await deleteDoc(callDocRef.current);
      }
    } catch (_) {}
  };

  const startCall = async (mode: 'audio'|'video') => {
    if (!firestore || !user) return;
    if (inCall) return;
    setInCall(true);
    setCallMode(mode);
    setIsConnecting(true);
    setCallError(null);
    const cdoc = doc(firestore, `universities/${university}/calls`, chatId);
    callDocRef.current = cdoc;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;
    
    // Set call timeout (45 seconds for ringing, then auto-hangup)
    callTimeoutRef.current = window.setTimeout(() => {
      if (inCall && isConnecting) {
        setCallError('Call timeout - recipient did not answer');
        cleanupCall().catch(() => {});
      }
    }, 45000);

    // local stream
    let stream: MediaStream | null = null;
    try {
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
      if (mode === 'video') {
        constraints.video = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
      }
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
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
      handleMediaError(e);
      setInCall(false);
      setIsConnecting(false);
      await cleanupCall();
      return;
    }

    // remote stream
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setIsConnecting(false);
      // Clear timeout on successful connection
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setCallError('Connection failed. Please try again.');
        cleanupCall().catch(() => {});
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        cleanupCall().catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        setCallError('Network connection failed. Please check your internet.');
        cleanupCall().catch(() => {});
      } else if (pc.iceConnectionState === 'disconnected') {
        cleanupCall().catch(() => {});
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        console.debug('ICE gathering complete');
      }
    };

    // ICE candidates
    const callerCandidatesCollection = collection(cdoc, 'callerCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        try { addDoc(callerCandidatesCollection, event.candidate.toJSON()).catch(e => console.warn('Failed to add ICE candidate:', e)); } catch (e) { console.warn(e); }
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
        await setDoc(cdoc, { offer: { type: offer.type, sdp: offer.sdp }, caller: user.uid, callee: calleeId, mode, status: 'ringing', createdAt: Date.now() });
      } catch (e) { 
        console.error('failed to set call doc', e);
        setCallError('Failed to initiate call. Please try again.');
        setInCall(false);
        await cleanupCall();
        return;
      }
    } catch (e) {
      console.error('offer creation failed', e);
      setCallError('Failed to create call offer. Please try again.');
      setInCall(false);
      setIsConnecting(false);
      await cleanupCall();
      return;
    }


    // Listen for answer
    const unsubAnswer = onSnapshot(cdoc, async (snap) => {
      if (!snap.exists()) {
        // Call doc deleted - probably rejected
        if (isConnecting) {
          setCallError('Call was rejected');
        }
        cleanupCall().catch(() => {});
        return;
      }
      const data = snap.data();
      if (!data) return;
      if (data.answer && pc && !pc.currentRemoteDescription) {
        const answer = new RTCSessionDescription(data.answer);
        try { 
          await pc.setRemoteDescription(answer); 
          // Clear timeout on answer received
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          setIsConnecting(false); 
        } catch (e) { 
          console.error('Failed to set remote description:', e);
          setCallError('Failed to establish connection');
        }
      }
      if (data.status === 'ended' || data.status === 'rejected') {
        cleanupCall().catch(() => {});
      }
    }, (err) => {
      console.error('Call answer snapshot error', err);
      setCallError('Lost connection to call server');
      cleanupCall().catch(()=>{});
    });

    // Listen for callee ICE candidates
    const calleeCandidatesCol = collection(cdoc, 'calleeCandidates');
    const unsubCallee = onSnapshot(calleeCandidatesCol, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          try { 
            if (pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.warn('Failed to add ICE candidate:', e)); 
            }
          } catch (e) { console.warn(e); }
        }
      });
    }, (err) => {
      console.error('Callee candidates snapshot error', err);
    });

    // Keep these unsubscribers stored on the pc for cleanup
    (pc as any).__cleanup = async () => { 
      try { unsubAnswer(); } catch (_) {}
      try { unsubCallee(); } catch (_) {}
    };
    
    callUnsubsRef.current.push(unsubAnswer, unsubCallee);
  };

  const answerCall = async () => {
    if (!firestore || !user) return;
    const cdoc = doc(firestore, `universities/${university}/calls`, chatId);
    const snap = await getDoc(cdoc);
    if (!snap.exists()) return;
    const data: any = snap.data();
    if (!data.offer) return;
    setInCall(true);
    setCallMode(data.mode === 'video' ? 'video' : 'audio');
    setIsConnecting(true);
    setCallError(null);
    stopRingtone();
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;

    // get local stream (audio/video as preferred by caller mode)
    let stream: MediaStream | null = null;
    try {
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
      if (data.mode === 'video') {
        constraints.video = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
      }
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
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
      handleMediaError(e);
      setInCall(false);
      setIsConnecting(false);
      // Reject the call
      try { await setDoc(cdoc, { status: 'rejected' }, { merge: true }); } catch(_) {}
      await cleanupCall();
      return;
    }

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setIsConnecting(false);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setCallError('Connection failed');
        cleanupCall().catch(() => {});
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        cleanupCall().catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        setCallError('Network connection failed');
        cleanupCall().catch(() => {});
      } else if (pc.iceConnectionState === 'disconnected') {
        cleanupCall().catch(() => {});
      }
    };

    const calleeCandidatesCollection = collection(cdoc, 'calleeCandidates');
    pc.onicecandidate = (event) => {
      if (event.candidate) addDoc(calleeCandidatesCollection, event.candidate.toJSON()).catch(()=>{});
    };

    // set remote desc from offer
    const offer = data.offer;
    try { 
      await pc.setRemoteDescription(new RTCSessionDescription(offer)); 
    } catch (e) { 
      console.error('Failed to set remote description:', e);
      setCallError('Failed to connect. Please try again.');
      setInCall(false);
      await cleanupCall();
      return;
    }

    let answer;
    try {
      answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } catch (e) {
      console.error('Failed to create answer:', e);
      setCallError('Failed to create answer. Please try again.');
      setInCall(false);
      await cleanupCall();
      return;
    }
    
    // write answer
    try { 
      await setDoc(cdoc, { answer: { type: answer.type, sdp: answer.sdp }, callee: user.uid, status: 'connected', updatedAt: Date.now() }, { merge: true }); 
    } catch (e) { 
      console.error('Failed to write answer to firestore:', e);
      setCallError('Failed to send answer. Please try again.');
      setInCall(false);
      await cleanupCall();
      return;
    }

    // listen for caller candidates
    const callerCandidatesCol = collection(cdoc, 'callerCandidates');
    const unsubCaller = onSnapshot(callerCandidatesCol, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          try { 
            if (pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.warn('Failed to add ICE candidate:', e)); 
            }
          } catch (e) { console.warn(e); }
        }
      });
    }, (err) => {
      console.error('Caller candidates snapshot error', err);
    });

    (pc as any).__cleanup = async () => { 
      try { unsubCaller(); } catch (_) {}
    };
    
    callUnsubsRef.current.push(unsubCaller);
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

      {callError && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/10 text-red-200 border-b border-red-500/30 text-xs sm:text-sm">
          {callError}
        </div>
      )}
      
      {/* Hidden audio element for local/remote streams */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      
      {/* Messages area with gradient background */}
      <div className="relative flex-1 overflow-hidden">
        {inCall && callMode === 'video' && (
          <div className="absolute inset-0 z-40 bg-black/90 flex flex-col">
            <div className="relative flex-1">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-slate-900/80 text-slate-100 text-xs sm:text-sm px-3 py-1 rounded-full border border-slate-700">
                {isConnecting ? 'Connecting...' : 'Video call'}
              </div>
              <div className="absolute bottom-24 right-4 w-28 h-40 sm:w-36 sm:h-52 rounded-xl overflow-hidden border-2 border-primary/60 shadow-xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 pb-6 pt-4 bg-gradient-to-t from-black/80 to-transparent">
              <button
                onClick={toggleMute}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                  isMuted ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
                }`}
                aria-label="Toggle mute"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                onClick={toggleVideo}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                  isVideoOff ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
                }`}
                aria-label="Toggle camera"
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>
              <button
                onClick={hangup}
                className="h-12 w-12 rounded-full bg-red-600 text-white flex items-center justify-center"
                aria-label="End call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {inCall && callMode === 'audio' && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-slate-950/90 border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-100 font-medium">Audio call</div>
              <div className="text-xs text-slate-400">{isConnecting ? 'Connecting...' : 'Connected'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                  isMuted ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
                }`}
                aria-label="Toggle mute"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={hangup}
                className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center"
                aria-label="End call"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
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
              // Determine the sender's real name and verification status
              const isCurrentUserPassenger = meta?.passengerId === user?.uid;
              
              // For received messages (not own), get the OTHER person's details
              let senderDetails: any = null;
              if (m.senderId !== user?.uid) {
                // Sender is NOT current user - determine which details to show
                if (m.senderId === meta?.passengerId) {
                  // Sender is the passenger
                  senderDetails = meta?.passengerDetails;
                } else if (m.senderId === meta?.providerId || m.senderId === meta?.driverId) {
                  // Sender is the provider/driver
                  senderDetails = meta?.providerDetails || meta?.driverDetails;
                } else {
                  // Fallback: use opposite of current user
                  senderDetails = isCurrentUserPassenger 
                    ? (meta?.providerDetails || meta?.driverDetails)
                    : meta?.passengerDetails;
                }
              }
              
              const senderName = senderDetails?.fullName || senderDetails?.name || null;
              const senderVerified = senderDetails?.universityEmailVerified || senderDetails?.verified || senderDetails?.isVerified || false;
              const initials = senderName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?';
              
              return (
                <MessageBubble 
                  key={m.id} 
                  message={m} 
                  isOwn={m.senderId === user?.uid}
                  senderName={senderName}
                  senderInitials={initials}
                  senderVerified={senderVerified}
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
                onClick={async () => { stopRingtone(); setIncomingCall(null); await answerCall(); }}
              >
                Accept
              </button>
              <button 
                className="px-6 py-3 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg" 
                onClick={async () => { 
                  stopRingtone(); 
                  setIncomingCall(null); 
                  try { 
                    if (callDocRef.current) {
                      await setDoc(callDocRef.current, { status: 'rejected' }, { merge: true });
                      await deleteDoc(callDocRef.current); 
                    }
                  } catch(_) {} 
                }}
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
