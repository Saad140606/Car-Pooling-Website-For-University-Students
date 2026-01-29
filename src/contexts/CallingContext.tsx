'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { webrtcCallingService, type CallData, type CallType } from '@/lib/webrtcCallingService';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';

interface CallingContextType {
  currentCall: CallData | null;
  incomingCall: CallData | null;
  isCallActive: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  initiateCall: (receiverId: string, receiverName: string, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  
  error: string | null;
}

const CallingContext = createContext<CallingContextType | undefined>(undefined);

export function CallingProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize calling service
  useEffect(() => {
    if (firestore && user?.uid) {
      webrtcCallingService.initialize(firestore, user.uid);
      console.debug('[CallingProvider] Initialized for user:', user.uid);
    }
  }, [firestore, user?.uid]);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const unsubscribe = webrtcCallingService.subscribeToIncomingCalls((call) => {
      console.debug('[CallingProvider] Incoming call:', call);
      setIncomingCall(call);
      setCurrentCall(call);
    });

    return () => unsubscribe();
  }, [firestore, user?.uid]);

  // Set up listeners
  useEffect(() => {
    webrtcCallingService.on({
      onIncomingCall: (call) => {
        setIncomingCall(call);
        setCurrentCall(call);
      },
      onCallAccepted: (call) => {
        setCurrentCall(call);
        setIncomingCall(null);
      },
      onCallEnded: (call) => {
        setCurrentCall(null);
        setIncomingCall(null);
        setLocalStream(null);
        setRemoteStream(null);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  }, []);

  const initiateCall = useCallback(async (receiverId: string, receiverName: string, callType: CallType) => {
    try {
      setError(null);
      const call = await webrtcCallingService.initiateCall(receiverId, receiverName, callType);
      setCurrentCall(call);
      setLocalStream(webrtcCallingService.getLocalMediaStream());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate call';
      setError(message);
      throw err;
    }
  }, []);

  const acceptCall = useCallback(async () => {
    try {
      setError(null);
      if (currentCall) {
        await webrtcCallingService.acceptCall(currentCall.id, currentCall.callType);
        setLocalStream(webrtcCallingService.getLocalMediaStream());
        setRemoteStream(webrtcCallingService.getRemoteMediaStream());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept call';
      setError(message);
      throw err;
    }
  }, [currentCall]);

  const rejectCall = useCallback(async () => {
    try {
      setError(null);
      if (currentCall) {
        await webrtcCallingService.rejectCall(currentCall.id);
        setCurrentCall(null);
        setIncomingCall(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject call';
      setError(message);
      throw err;
    }
  }, [currentCall]);

  const endCall = useCallback(async () => {
    try {
      setError(null);
      await webrtcCallingService.endCall();
      setCurrentCall(null);
      setIncomingCall(null);
      setLocalStream(null);
      setRemoteStream(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end call';
      setError(message);
      throw err;
    }
  }, []);

  return (
    <CallingContext.Provider
      value={{
        currentCall,
        incomingCall,
        isCallActive: !!currentCall,
        localStream,
        remoteStream,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        error,
      }}
    >
      {children}
    </CallingContext.Provider>
  );
}

export function useCallingContext() {
  const context = useContext(CallingContext);
  if (context === undefined) {
    throw new Error('useCallingContext must be used within CallingProvider');
  }
  return context;
}
