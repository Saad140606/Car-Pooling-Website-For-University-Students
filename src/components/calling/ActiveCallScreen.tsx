'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
import { useCallingContext } from '@/contexts/CallingContext';
import { motion } from 'framer-motion';

/**
 * ActiveCallScreen: Active call UI with video/audio display
 */
export function ActiveCallScreen() {
  const { currentCall, localStream, remoteStream, endCall } = useCallingContext();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<number | null>(null);

  // Play local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Play remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Track call duration
  useEffect(() => {
    durationIntervalRef.current = window.setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentCall) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Remote video (main) */}
      {currentCall.callType === 'video' ? (
        <div className="relative flex-1 bg-gradient-to-b from-slate-950 to-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Remote user name overlay */}
          <div className="absolute top-8 left-8 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full text-white text-sm font-semibold border border-primary/30">
            {currentCall.callerId}
          </div>

          {/* Duration overlay */}
          <div className="absolute top-8 right-8 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full text-white text-sm font-semibold">
            {formatDuration(duration)}
          </div>

          {/* Local video (picture-in-picture) */}
          <div className="absolute bottom-24 right-6 w-32 h-48 rounded-xl overflow-hidden border-4 border-primary/60 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : (
        // Audio call UI
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
          {/* Caller info */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center border-4 border-primary/60">
              <div className="text-4xl font-bold text-white">
                {currentCall.callerId?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">{currentCall.callerId}</h2>
              <p className="text-slate-400 mt-2">{formatDuration(duration)}</p>
            </div>
          </motion.div>

          {/* Audio visualizer */}
          <div className="flex items-center justify-center gap-1 h-20">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [12, Math.random() * 60 + 20, 12] }}
                transition={{
                  duration: Math.random() * 0.5 + 0.3,
                  repeat: Infinity,
                }}
                className="w-1 bg-gradient-to-t from-primary to-accent rounded-full"
              />
            ))}
          </div>
        </div>
      )}

      {/* Control buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 items-center justify-center"
      >
        {/* Mute button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleMute}
          className={`h-16 w-16 rounded-full flex items-center justify-center transition-all duration-200 ${
            isMuted
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/50'
              : 'bg-slate-700 hover:bg-slate-600 text-white shadow-xl shadow-slate-700/50'
          }`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </motion.button>

        {/* Video button (only for video calls) */}
        {currentCall.callType === 'video' && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            className={`h-16 w-16 rounded-full flex items-center justify-center transition-all duration-200 ${
              isVideoOff
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/50'
                : 'bg-slate-700 hover:bg-slate-600 text-white shadow-xl shadow-slate-700/50'
            }`}
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </motion.button>
        )}

        {/* End call button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={endCall}
          className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/50 hover:shadow-red-600/75 transition-all duration-200"
        >
          <PhoneOff className="h-6 w-6" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
