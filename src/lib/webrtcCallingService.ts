/**
 * WebRTC Calling Service
 * Handles audio and video calls with signaling
 */

import { Firestore, collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, DocumentReference, getDoc } from 'firebase/firestore';
import { ringtoneManager } from './ringtoneManager';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'disconnected' | 'rejected' | 'missed' | 'ended';

export interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  callerVerified?: boolean;
  receiverId: string;
  callType: CallType;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  offer?: any;
  answer?: any;
  candidates: any[];
  createdAt: Date;
  rideId?: string;
}

export interface CallListener {
  onIncomingCall?: (call: CallData) => void;
  onCallAccepted?: (call: CallData) => void;
  onCallRejected?: (call: CallData) => void;
  onCallEnded?: (call: CallData) => void;
  onCallMissed?: (call: CallData) => void;
  onError?: (error: Error) => void;
}

class WebRTCCallingService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: CallData | null = null;
  private firestore: Firestore | null = null;
  private currentUserId: string | null = null;
  private universityId: string | null = null;
  private listeners: CallListener = {};
  private callTimeout: number | null = null;
  private hasNotifiedConnected = false;
  private callDocUnsub: (() => void) | null = null;
  private remoteCandidatesUnsub: (() => void) | null = null;
  private iceRole: 'caller' | 'callee' | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  /**
   * Initialize the calling service
   */
  initialize(firestore: Firestore, userId: string, universityId?: string | null): void {
    this.firestore = firestore;
    this.currentUserId = userId;
    this.universityId = universityId || this.universityId;
    console.debug('[WebRTCCalling] Service initialized for user:', userId);
  }

  private getCallsCollection() {
    if (!this.firestore || !this.universityId) return null;
    return collection(this.firestore, 'universities', this.universityId, 'calls');
  }

  private getCallDoc(callId: string) {
    if (!this.firestore || !this.universityId) return null;
    return doc(this.firestore, 'universities', this.universityId, 'calls', callId);
  }

  /**
   * Set up event listeners
   */
  on(listener: CallListener): () => void {
    this.listeners = { ...this.listeners, ...listener };
    return () => {
      this.listeners = {};
    };
  }

  /**
   * Create peer connection
   */
  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Track connection state changes but don't disconnect immediately
    let connectionFailureCount = 0;
    const connectionFailureThreshold = 3; // Allow some transient failures

    pc.ontrack = (event) => {
      console.debug('[WebRTCCalling] Remote track received:', event.track.kind);
      this.remoteStream = event.streams[0];
      if (!this.hasNotifiedConnected && this.currentCall) {
        this.hasNotifiedConnected = true;
        this.listeners.onCallAccepted?.(this.currentCall);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        this.saveICECandidate(this.currentCall.id, event.candidate, this.iceRole || 'caller')
          .catch((error) => {
            console.warn('[WebRTCCalling] Failed to save ICE candidate:', error);
            // Don't fail the entire call on candidate failure
          });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.debug('[WebRTCCalling] ICE gathering state:', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.debug('[WebRTCCalling] ICE connection state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.debug('[WebRTCCalling] Connection state changed:', state);

      switch (state) {
        case 'connected':
          connectionFailureCount = 0; // Reset on successful connection
          console.debug('[WebRTCCalling] ✅ Connection established');
          break;
        case 'disconnected':
          connectionFailureCount++;
          console.warn('[WebRTCCalling] Connection disconnected, attempt:', connectionFailureCount);
          // Don't end call immediately on disconnect - might recover
          if (connectionFailureCount >= connectionFailureThreshold) {
            console.error('[WebRTCCalling] Connection failed after', connectionFailureThreshold, 'attempts');
            this.endCall().catch(console.error);
          }
          break;
        case 'failed':
          console.error('[WebRTCCalling] ❌ Connection failed');
          this.endCall().catch(console.error);
          break;
        case 'closed':
          console.debug('[WebRTCCalling] Connection closed');
          break;
      }
    };

    pc.onsignalingstatechange = () => {
      console.debug('[WebRTCCalling] Signaling state:', pc.signalingState);
    };

    return pc;
  }

  /**
   * Get local media stream
   */
  async getLocalStream(
    callType: CallType,
    onProgress?: (status: string) => void
  ): Promise<MediaStream> {
    try {
      onProgress?.('Requesting microphone access...');

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      if (callType === 'video') {
        onProgress?.('Requesting camera access...');
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      onProgress?.('Devices ready');
      return this.localStream;
    } catch (error) {
      console.error('[WebRTCCalling] Failed to get local stream:', error);
      throw error;
    }
  }

  /**
   * Start outgoing call
   */
  async initiateCall(
    receiverId: string,
    receiverName: string,
    callType: CallType,
    receiverPhoto?: string,
    callerName?: string,
    callerPhoto?: string,
    callerVerified?: boolean,
    rideId?: string
  ): Promise<CallData> {
    if (!this.firestore || !this.currentUserId || !this.universityId) {
      throw new Error('Service not initialized');
    }

    try {
      // Get local stream
      const stream = await this.getLocalStream(callType, (status) => {
        console.debug('[WebRTCCalling]', status);
      });

      // Create peer connection
      this.peerConnection = this.createPeerConnection();
      stream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Create call document in Firestore
      const callData: Omit<CallData, 'id'> = {
        callerId: this.currentUserId,
        callerName: callerName || this.currentUserId,
        callerPhoto: callerPhoto,
        callerVerified: callerVerified || false,
        receiverId,
        callType,
        status: 'ringing',
        offer: this.serializeOffer(offer),
        candidates: [],
        createdAt: serverTimestamp() as any,
        rideId: rideId,
      };

      const callsCollection = this.getCallsCollection();
      if (!callsCollection) {
        throw new Error('Calls collection not available');
      }
      const callRef = await addDoc(callsCollection, callData);
      this.currentCall = { id: callRef.id, ...callData, createdAt: new Date() };
      this.hasNotifiedConnected = false;
      this.iceRole = 'caller';

      // Listen for answer + remote candidates
      this.listenForCallUpdates(this.currentCall.id, 'caller');

      // Set call timeout (30 seconds)
      this.callTimeout = window.setTimeout(() => {
        if (this.currentCall?.status === 'ringing') {
          console.debug('[WebRTCCalling] Call timeout - missed');
          this.endCall();
          this.listeners.onCallMissed?.(this.currentCall);
        }
      }, 30000);

      console.debug('[WebRTCCalling] Call initiated:', this.currentCall.id);
      return this.currentCall;
    } catch (error) {
      console.error('[WebRTCCalling] Failed to initiate call:', error);
      this.listeners.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Listen for incoming calls
   */
  subscribeToIncomingCalls(onIncoming: (call: CallData) => void): () => void {
    if (!this.firestore || !this.currentUserId || !this.universityId) {
      console.warn('[WebRTCCalling] Service not initialized for incoming calls');
      return () => {};
    }

    const callsCollection = this.getCallsCollection();
    if (!callsCollection) return () => {};

    const q = query(
      callsCollection,
      where('receiverId', '==', this.currentUserId),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const call: CallData = {
              id: change.doc.id,
              ...change.doc.data(),
              createdAt: change.doc.data().createdAt?.toDate?.() || new Date(),
            } as CallData;

            this.currentCall = call;

            // Play ringtone for incoming call
            try {
              ringtoneManager.playRingtone();
              ringtoneManager.vibrate([200, 100, 200, 100, 200]);
            } catch (error) {
              console.error('[WebRTCCalling] Ringtone/vibrate error:', error);
            }

            onIncoming(call);
            this.listeners.onIncomingCall?.(call);
          }
        });
      },
      (error) => {
        // Gracefully handle permission denied errors
        if (error.code === 'permission-denied') {
          console.warn('[WebRTCCalling] Permission denied for calls query. Calls may not be available yet.');
        } else {
          console.error('[WebRTCCalling] Error subscribing to incoming calls:', error);
        }
      }
    );

    return () => unsubscribe();
  }

  /**
   * Accept incoming call
   */
  async acceptCall(callId: string, callType: CallType): Promise<void> {
    if (!this.firestore || !this.universityId) {
      throw new Error('Service not initialized');
    }

    // Stop ringtone when accepting
    ringtoneManager.stopRingtone();

    if (!this.peerConnection) {
      // Create new peer connection
      this.peerConnection = this.createPeerConnection();
    }

    try {
      this.iceRole = 'callee';
      this.hasNotifiedConnected = false;
      
      console.debug('[WebRTCCalling] Accepting call:', callId);

      // Get offer from call document first (before creating local stream)
      const callDoc = this.getCallDoc(callId);
      if (!callDoc) throw new Error('Call document not available');
      const callSnapshot = await getDoc(callDoc);
      const callData = callSnapshot.data() as any;
      
      if (!callData) {
        throw new Error('Call document not found');
      }

      const offer = callData.offer;
      if (!offer) {
        throw new Error('No offer found in call document');
      }

      console.debug('[WebRTCCalling] Setting remote description from offer...');
      
      // Set remote description first
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.deserializeOffer(offer)));
        console.debug('[WebRTCCalling] ✅ Remote description set');
      } catch (error) {
        console.error('[WebRTCCalling] ❌ Failed to set remote description:', error);
        throw error;
      }

      // Get local stream
      console.debug('[WebRTCCalling] Requesting local media...');
      const stream = await this.getLocalStream(callType);
      this.localStream = stream;
      
      stream.getTracks().forEach((track, index) => {
        console.debug('[WebRTCCalling] Adding track:', { index, kind: track.kind });
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create answer
      console.debug('[WebRTCCalling] Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      
      // Set local description
      console.debug('[WebRTCCalling] Setting local description...');
      await this.peerConnection.setLocalDescription(answer);
      console.debug('[WebRTCCalling] ✅ Local description set');

      // Update call document with answer
      console.debug('[WebRTCCalling] Updating call document with answer...');
      await updateDoc(callDoc, {
        answer: this.serializeOffer(answer),
        status: 'connected',
        acceptedAt: serverTimestamp(),
      });
      console.debug('[WebRTCCalling] ✅ Call document updated');

      // Setup current call if not already set
      if (!this.currentCall) {
        this.currentCall = {
          id: callId,
          callerId: callData.callerId,
          callerName: callData.callerName,
          receiverId: this.currentUserId || '',
          callType,
          status: 'connected',
          candidates: [],
          createdAt: callData.createdAt?.toDate?.() || new Date(),
        };
      }

      // Listen for caller candidates and remote hangup
      this.listenForCallUpdates(callId, 'callee');

      console.debug('[WebRTCCalling] ✅ Call accepted successfully');
    } catch (error) {
      console.error('[WebRTCCalling] ❌ Failed to accept call:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.listeners.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reject incoming call
   */
  async rejectCall(callId: string): Promise<void> {
    if (!this.firestore || !this.universityId) return;

    // Stop ringtone when rejecting
    ringtoneManager.stopRingtone();

    try {
      const callDoc = this.getCallDoc(callId);
      if (!callDoc) return;
      await updateDoc(callDoc, {
        status: 'rejected',
        endedAt: serverTimestamp(),
      });

      console.debug('[WebRTCCalling] Call rejected:', callId);
    } catch (error) {
      console.error('[WebRTCCalling] Failed to reject call:', error);
    }
  }

  /**
   * End call
   */
  async endCall(): Promise<void> {
    // Stop ringtone
    ringtoneManager.stopRingtone();

    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
    }

    // Stop all tracks
    this.localStream?.getTracks().forEach(track => track.stop());
    this.remoteStream?.getTracks().forEach(track => track.stop());

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Update call status in Firestore
    if (this.firestore && this.currentCall && this.universityId) {
      try {
        const callDoc = this.getCallDoc(this.currentCall.id);
        if (!callDoc) throw new Error('Call document not available');
        await updateDoc(callDoc, {
          status: 'ended',
          endedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('[WebRTCCalling] Failed to update call status:', error);
      }
    }

    this.cleanupSignaling();

    this.listeners.onCallEnded?.(this.currentCall!);
    this.currentCall = null;
    this.localStream = null;
    this.remoteStream = null;
    this.hasNotifiedConnected = false;

    console.debug('[WebRTCCalling] Call ended');
  }

  /**
   * Save ICE candidate
   */
  private async saveICECandidate(callId: string, candidate: RTCIceCandidate, role: 'caller' | 'callee'): Promise<void> {
    if (!this.firestore || !this.universityId) return;

    try {
      const callDoc = this.getCallDoc(callId);
      if (!callDoc) return;
      const target = role === 'callee' ? 'calleeCandidates' : 'callerCandidates';
      
      const candidateData = this.serializeCandidate(candidate);
      
      console.debug('[WebRTCCalling] Saving ICE candidate:', { 
        candidate: candidateData.candidate?.substring(0, 50) + '...', 
        role, 
        sdpMLineIndex: candidateData.sdpMLineIndex
      });
      
      await addDoc(collection(callDoc, target), {
        ...candidateData,
        addedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.warn('[WebRTCCalling] Failed to save ICE candidate:', {
        code: error.code,
        message: error.message,
        role
      });
      // Non-critical error - don't rethrow
    }
  }

  /**
   * Listen for call updates and remote ICE candidates
   */
  private listenForCallUpdates(callId: string, role: 'caller' | 'callee'): void {
    if (!this.firestore || !this.peerConnection || !this.universityId) return;

    this.cleanupSignaling();

    const callDoc = this.getCallDoc(callId);
    if (!callDoc) return;
    
    this.callDocUnsub = onSnapshot(callDoc, async (snap) => {
      try {
        if (!snap.exists()) {
          console.debug('[WebRTCCalling] Call document deleted');
          this.handleRemoteHangup();
          return;
        }
        
        const data = snap.data() as any;
        
        // Handle answer (for caller) 
        if (role === 'caller' && data?.answer && !this.peerConnection?.currentRemoteDescription) {
          try {
            console.debug('[WebRTCCalling] Setting remote answer...');
            await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(this.deserializeOffer(data.answer)));
            console.debug('[WebRTCCalling] ✅ Remote answer set successfully');
            if (this.currentCall) {
              this.listeners.onCallAccepted?.(this.currentCall);
            }
          } catch (error) {
            console.error('[WebRTCCalling] ❌ Failed to set remote answer:', error);
            // Non-fatal - connection might still establish
          }
        }

        // Handle remote status changes
        if (data?.status === 'ended' || data?.status === 'rejected') {
          console.debug('[WebRTCCalling] Remote ended/rejected call');
          this.handleRemoteHangup();
        }
      } catch (error) {
        console.error('[WebRTCCalling] Error in call doc listener:', error);
      }
    }, (error) => {
      console.error('[WebRTCCalling] ❌ Snapshot error on call doc:', {
        code: error.code,
        message: error.message
      });
    });

    // Listen for remote ICE candidates
    const remoteCollection = collection(callDoc, role === 'caller' ? 'calleeCandidates' : 'callerCandidates');
    
    this.remoteCandidatesUnsub = onSnapshot(remoteCollection, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          try {
            const candidateData = change.doc.data();
            
            // Ignore if no candidate string
            if (!candidateData.candidate) {
              console.debug('[WebRTCCalling] Skipping empty ICE candidate');
              return;
            }
            
            const iceCandidate = new RTCIceCandidate(candidateData);
            
            console.debug('[WebRTCCalling] Adding remote ICE candidate:', {
              candidate: candidateData.candidate.substring(0, 50) + '...',
              sdpMLineIndex: candidateData.sdpMLineIndex
            });
            
            this.peerConnection?.addIceCandidate(iceCandidate)
              .catch((error) => {
                console.warn('[WebRTCCalling] Failed to add ICE candidate:', {
                  message: error.message,
                  candidate: candidateData.candidate.substring(0, 30)
                });
                // Non-fatal - connection might work without this candidate
              });
          } catch (error) {
            console.warn('[WebRTCCalling] Failed to parse ICE candidate:', error);
          }
        }
      });
    }, (error) => {
      console.error('[WebRTCCalling] ❌ Snapshot error on candidates:', {
        code: error.code,
        message: error.message
      });
    });
  }

  private cleanupSignaling(): void {
    try { this.callDocUnsub?.(); } catch (_) {}
    try { this.remoteCandidatesUnsub?.(); } catch (_) {}
    this.callDocUnsub = null;
    this.remoteCandidatesUnsub = null;
  }

  private handleRemoteHangup(): void {
    this.cleanupSignaling();

    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    // Stop all tracks
    this.localStream?.getTracks().forEach(track => track.stop());
    this.remoteStream?.getTracks().forEach(track => track.stop());

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch (_) {}
      this.peerConnection = null;
    }

    this.listeners.onCallEnded?.(this.currentCall!);
    this.currentCall = null;
    this.localStream = null;
    this.remoteStream = null;
    this.hasNotifiedConnected = false;
  }

  /**
   * Serialize offer/answer for Firestore
   */
  private serializeOffer(offer: RTCSessionDescriptionInit | RTCSessionDescription): any {
    const desc = offer as any;
    return {
      type: desc.type,
      sdp: desc.sdp,
    };
  }

  /**
   * Deserialize offer/answer from Firestore
   */
  private deserializeOffer(obj: any): RTCSessionDescription {
    return new RTCSessionDescription({
      type: obj.type,
      sdp: obj.sdp,
    });
  }

  /**
   * Serialize ICE candidate
   */
  private serializeCandidate(candidate: RTCIceCandidate): any {
    return {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    };
  }

  /**
   * Get local stream
   */
  getLocalMediaStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteMediaStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get current call
   */
  getCurrentCall(): CallData | null {
    return this.currentCall;
  }
}

export const webrtcCallingService = new WebRTCCallingService();
