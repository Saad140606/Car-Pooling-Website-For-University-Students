'use client';

import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Maximize2 } from 'lucide-react';
import { useCallingContext } from '@/contexts/CallingContext';
import { motion } from 'framer-motion';

/**
 * IncomingCallScreen: Full-screen incoming call UI (like WhatsApp/Instagram)
 */
export function IncomingCallScreen() {
  const { incomingCall, acceptCall, rejectCall, currentCall } = useCallingContext();
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setIsRinging(true);
      playRingtone();
    }
  }, [incomingCall]);

  const playRingtone = () => {
    try {
      const audio = new Audio('/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.5;
      audio.play().catch(() => {
        console.debug('Could not play ringtone');
      });
    } catch (error) {
      console.debug('Ringtone error:', error);
    }
  };

  if (!incomingCall) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-black flex flex-col items-center justify-center"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 space-y-8">
        {/* Caller avatar */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center space-y-6"
        >
          <div className="relative">
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full border-4 border-primary/40 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />

            {/* Avatar */}
            <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center border-4 border-primary/60 shadow-2xl shadow-primary/50">
              {incomingCall.callerPhoto ? (
                <img
                  src={incomingCall.callerPhoto}
                  alt={incomingCall.callerName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="text-4xl font-bold text-white">
                  {incomingCall.callerName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Caller info */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              {incomingCall.callerName}
            </h2>
            <p className="text-lg text-slate-300">
              {incomingCall.callType === 'video' ? 'Video call' : 'Audio call'} incoming...
            </p>
          </div>
        </motion.div>

        {/* Call buttons */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex gap-8 items-center justify-center"
        >
          {/* Reject button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={rejectCall}
            className="h-20 w-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/50 hover:shadow-red-600/75 transition-all duration-200"
          >
            <PhoneOff className="h-8 w-8" />
          </motion.button>

          {/* Accept button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={acceptCall}
            className="h-24 w-24 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-xl shadow-green-600/50 hover:shadow-green-600/75 transition-all duration-200 group"
          >
            <Phone className="h-10 w-10 transition-transform group-hover:rotate-12" />
          </motion.button>

          {/* Empty space for alignment */}
          <div className="h-20 w-20" />
        </motion.div>
      </div>

      {/* Call type badge */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-8 right-8 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full border border-primary/30 text-sm text-slate-200 flex items-center gap-2"
      >
        <Maximize2 className="h-4 w-4 text-primary" />
        {incomingCall.callType === 'video' ? 'Video Call' : 'Audio Call'}
      </motion.div>
    </motion.div>
  );
}
