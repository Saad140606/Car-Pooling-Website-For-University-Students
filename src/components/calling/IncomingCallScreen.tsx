'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Maximize2, Video, ShieldCheck } from 'lucide-react';
import { useCallingContext } from '@/contexts/CallingContext';
import { ringtoneManager } from '@/lib/ringtoneManager';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * IncomingCallScreen: Full-screen incoming call UI (like WhatsApp/Instagram)
 * Features:
 * - Beautiful animated UI with caller info
 * - Ringtone management with proper cleanup
 * - Accept/Reject buttons with haptic feedback
 * - Verification badge for verified callers
 */
export function IncomingCallScreen() {
  const { incomingCall, acceptCall, rejectCall, currentCall } = useCallingContext();
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone when incoming call detected
  useEffect(() => {
    if (incomingCall && !currentCall) {
      setIsRinging(true);
      
      // Use the ringtone manager for consistent audio handling
      try {
        ringtoneManager.playRingtone();
        ringtoneManager.vibrate([200, 100, 200, 100, 200]);
      } catch (error) {
        console.debug('[IncomingCallScreen] Ringtone playback error:', error);
      }
    }

    // Cleanup on unmount or when call state changes
    return () => {
      try {
        ringtoneManager.stopRingtone();
        ringtoneManager.stopVibration();
      } catch (error) {
        console.debug('[IncomingCallScreen] Ringtone cleanup error:', error);
      }
    };
  }, [incomingCall, currentCall]);

  // Stop ringtone when call is accepted or rejected
  useEffect(() => {
    if (currentCall || !incomingCall) {
      try {
        ringtoneManager.stopRingtone();
        ringtoneManager.stopVibration();
        setIsRinging(false);
      } catch (error) {
        console.debug('[IncomingCallScreen] Stop ringtone error:', error);
      }
    }
  }, [currentCall, incomingCall]);

  const handleAccept = () => {
    try {
      ringtoneManager.stopRingtone();
      ringtoneManager.stopVibration();
      // Play accept sound
      ringtoneManager.playNotificationSound();
    } catch (error) {
      console.debug('[IncomingCallScreen] Accept sound error:', error);
    }
    acceptCall();
  };

  const handleReject = () => {
    try {
      ringtoneManager.stopRingtone();
      ringtoneManager.stopVibration();
    } catch (error) {
      console.debug('[IncomingCallScreen] Reject cleanup error:', error);
    }
    rejectCall();
  };

  if (!incomingCall) return null;

  const isVideoCall = incomingCall.callType === 'video';
  const callerVerified = incomingCall.callerVerified || false;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-950 via-slate-900 to-black flex flex-col items-center justify-center"
      >
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl" 
          />
          <motion.div 
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute -bottom-20 left-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" 
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 space-y-8 px-6">
          {/* Caller avatar */}
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="relative">
              {/* Animated ripple rings */}
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-4 border-primary/40" 
              />
              <motion.div 
                animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                className="absolute inset-0 rounded-full border-2 border-primary/30" 
              />
              <motion.div 
                animate={{ scale: [1, 2.1], opacity: [0.2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                className="absolute inset-0 rounded-full border border-primary/20" 
              />

              {/* Avatar container */}
              <div className="relative h-36 w-36 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center border-4 border-primary/60 shadow-2xl shadow-primary/50">
                {incomingCall.callerPhoto ? (
                  <img
                    src={incomingCall.callerPhoto}
                    alt={incomingCall.callerName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="text-5xl font-bold text-white">
                    {incomingCall.callerName?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}

                {/* Verification badge */}
                {callerVerified && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5 border-2 border-slate-950"
                  >
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Caller info */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl sm:text-4xl font-bold text-white">
                  {incomingCall.callerName || 'Unknown Caller'}
                </h2>
                {callerVerified && (
                  <div className="bg-emerald-500/20 rounded-full px-2 py-0.5">
                    <span className="text-emerald-400 text-xs font-medium">Verified</span>
                  </div>
                )}
              </div>
              <motion.p 
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-lg text-slate-300 flex items-center justify-center gap-2"
              >
                {isVideoCall ? <Video className="h-5 w-5 text-primary" /> : <Phone className="h-5 w-5 text-primary" />}
                {isVideoCall ? 'Incoming video call...' : 'Incoming audio call...'}
              </motion.p>
            </div>
          </motion.div>

          {/* Slide to answer hint */}
          <motion.p
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-slate-400 text-sm"
          >
            Tap to answer or decline
          </motion.p>

          {/* Call buttons */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex gap-10 items-center justify-center"
          >
            {/* Reject button */}
            <div className="flex flex-col items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReject}
                className="h-20 w-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/50 hover:shadow-red-500/75 transition-all duration-200"
              >
                <PhoneOff className="h-8 w-8" />
              </motion.button>
              <span className="text-slate-400 text-sm font-medium">Decline</span>
            </div>

            {/* Accept button */}
            <div className="flex flex-col items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                animate={{ 
                  boxShadow: ['0 20px 25px -5px rgba(34, 197, 94, 0.4)', '0 20px 35px -5px rgba(34, 197, 94, 0.6)', '0 20px 25px -5px rgba(34, 197, 94, 0.4)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                onClick={handleAccept}
                className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 hover:from-green-300 hover:to-green-500 text-white flex items-center justify-center shadow-xl transition-all duration-200 group"
              >
                {isVideoCall ? (
                  <Video className="h-10 w-10 transition-transform group-hover:scale-110" />
                ) : (
                  <Phone className="h-10 w-10 transition-transform group-hover:rotate-12" />
                )}
              </motion.button>
              <span className="text-white text-sm font-semibold">Accept</span>
            </div>
          </motion.div>
        </div>

        {/* Call type badge */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-8 right-8 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-full border border-primary/30 text-sm text-slate-200 flex items-center gap-2"
        >
          {isVideoCall ? <Video className="h-4 w-4 text-primary" /> : <Maximize2 className="h-4 w-4 text-primary" />}
          {isVideoCall ? 'Video Call' : 'Audio Call'}
        </motion.div>
        
        {/* Safe area bottom padding for mobile */}
        <div className="h-8 sm:h-0" />
      </motion.div>
    </AnimatePresence>
  );
}
