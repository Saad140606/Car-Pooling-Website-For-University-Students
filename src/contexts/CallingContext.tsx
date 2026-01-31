'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { webrtcCallingService, type CallData, type CallType } from '@/lib/webrtcCallingService';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { notifyMissedCall } from '@/lib/rideNotificationService';
import { useNotifications } from '@/contexts/NotificationContext';

interface CallingContextType {
  currentCall: CallData | null;
  incomingCall: CallData | null;
  isCallActive: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  missedCallCount: number;
  
  initiateCall: (receiverId: string, receiverName: string, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  clearMissedCalls: () => void;
  
  error: string | null;
}

const CallingContext = createContext<CallingContextType | undefined>(undefined);

// Call timeout for missed call detection (30 seconds)
const CALL_TIMEOUT_MS = 30000;

export function CallingProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const { user, data: userData } = useUser();
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missedCallCount, setMissedCallCount] = useState(0);
  
  // Track incoming call start time for missed call detection
  const incomingCallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedCallRef = useRef<string | null>(null);

  // Initialize calling service
  useEffect(() => {
    if (firestore && user?.uid) {
      webrtcCallingService.initialize(firestore, user.uid);
      console.debug('[CallingProvider] Initialized for user:', user.uid);
    }
  }, [firestore, user?.uid]);

  // Handle missed call detection
  const handleMissedCall = useCallback(async (call: CallData) => {
    // Prevent duplicate missed call notifications
    if (lastProcessedCallRef.current === call.id) {
      return;
    }
    lastProcessedCallRef.current = call.id;
    
    if (!firestore || !user?.uid || !userData?.university) {
      console.debug('[CallingProvider] Missing data for missed call notification');
      return;
    }
    
    try {
      await notifyMissedCall(
        firestore,
        userData.university,
        user.uid,
        call.callerName || 'Unknown Caller',
        call.callerId,
        call.callType,
        call.rideId
      );
      setMissedCallCount(prev => prev + 1);
      console.debug('[CallingProvider] Missed call notification sent');
    } catch (err) {
      console.error('[CallingProvider] Failed to create missed call notification:', err);
    }
  }, [firestore, user?.uid, userData?.university]);

  // Subscribe to incoming calls with missed call detection
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const unsubscribe = webrtcCallingService.subscribeToIncomingCalls((call) => {
      console.debug('[CallingProvider] Incoming call:', call);
      
      // Clear any existing timer
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
      }
      
      setIncomingCall(call);
      setCurrentCall(call);
      
      // Set up missed call timer
      incomingCallTimerRef.current = setTimeout(() => {
        // Check if call is still incoming (not answered/rejected)
        if (call && call.status === 'ringing') {
          console.debug('[CallingProvider] Call timed out - marking as missed');
          handleMissedCall(call);
          setIncomingCall(null);
        }
      }, CALL_TIMEOUT_MS);
    });

    return () => {
      unsubscribe();
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
      }
    };
  }, [firestore, user?.uid, handleMissedCall]);

  // Set up listeners
  useEffect(() => {
    webrtcCallingService.on({
      onIncomingCall: (call) => {
        setIncomingCall(call);
        setCurrentCall(call);
      },
      onCallAccepted: (call) => {
        // Clear missed call timer when call is accepted
        if (incomingCallTimerRef.current) {
          clearTimeout(incomingCallTimerRef.current);
          incomingCallTimerRef.current = null;
        }
        setCurrentCall(call);
        setIncomingCall(null);
        setLocalStream(webrtcCallingService.getLocalMediaStream());
        setRemoteStream(webrtcCallingService.getRemoteMediaStream());
      },
      onCallEnded: (call) => {
        // Clear missed call timer
        if (incomingCallTimerRef.current) {
          clearTimeout(incomingCallTimerRef.current);
          incomingCallTimerRef.current = null;
        }
        
        // Check if this was a missed call (call ended while still ringing)
        if (call && call.status === 'ended' && incomingCall && incomingCall.id === call.id) {
          // The call was not answered
          handleMissedCall(call);
        }
        
        setCurrentCall(null);
        setIncomingCall(null);
        setLocalStream(null);
        setRemoteStream(null);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  }, [incomingCall, handleMissedCall]);

  const initiateCall = useCallback(async (receiverId: string, receiverName: string, callType: CallType) => {
    try {
      setError(null);
      const callerName = userData?.fullName || user?.displayName || user?.email || 'Campus Ride User';
      const callerPhoto = user?.photoURL || undefined;
      const callerVerified = userData?.universityEmailVerified || (userData as any)?.verified || false;
      const call = await webrtcCallingService.initiateCall(
        receiverId, 
        receiverName, 
        callType, 
        undefined, 
        callerName, 
        callerPhoto,
        callerVerified
      );
      setCurrentCall(call);
      setLocalStream(webrtcCallingService.getLocalMediaStream());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate call';
      setError(message);
      throw err;
    }
  }, [userData?.fullName, userData?.universityEmailVerified, user?.displayName, user?.email, user?.photoURL]);

  const acceptCall = useCallback(async () => {
    try {
      setError(null);
      // Clear missed call timer
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
        incomingCallTimerRef.current = null;
      }
      if (currentCall) {
        await webrtcCallingService.acceptCall(currentCall.id, currentCall.callType);
        setLocalStream(webrtcCallingService.getLocalMediaStream());
        setRemoteStream(webrtcCallingService.getRemoteMediaStream());
        setIncomingCall(null);
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
      // Clear missed call timer
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
        incomingCallTimerRef.current = null;
      }
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
      // Clear missed call timer
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
        incomingCallTimerRef.current = null;
      }
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

  const clearMissedCalls = useCallback(() => {
    setMissedCallCount(0);
  }, []);

  return (
    <CallingContext.Provider
      value={{
        currentCall,
        incomingCall,
        isCallActive: !!currentCall,
        localStream,
        remoteStream,
        missedCallCount,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        clearMissedCalls,
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
