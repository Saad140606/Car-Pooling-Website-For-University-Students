import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { voiceMessageService } from '@/lib/voiceMessageService';

export default function VoiceRecorder({ onSend }: { onSend: (url: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        try {
          voiceMessageService.abortRecording();
        } catch (_) {}
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!voiceMessageService.isSupported()) {
        alert('Voice recording is not supported in your browser. Please use Chrome, Firefox, or Edge.');
        return;
      }

      await voiceMessageService.startRecording();
      setRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      console.error('[VoiceRecorder] Failed to start recording:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings to record voice messages.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Failed to start recording. Please check your microphone and browser permissions.');
      }
    }
  };

  const stopRecording = async () => {
    try {
      const blob = await voiceMessageService.stopRecording();
      setAudioBlob(blob);
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      console.error('[VoiceRecorder] Failed to stop recording:', err);
      alert('Failed to stop recording. Please try again.');
    }
  };

  const cancelRecording = () => {
    setAudioBlob(null);
    setDuration(0);
  };


  const sendVoice = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const voiceData = await voiceMessageService.uploadVoiceMessage(audioBlob, '');
      await onSend(voiceData.url);
      setAudioBlob(null);
      setDuration(0);
    } catch (err: any) {
      console.error('[VoiceRecorder] Failed to upload voice:', err);
      const errorMessage = err?.message || 'Failed to send voice message. Please try again.';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-full">
        <button
          onClick={cancelRecording}
          className="p-2 rounded-full hover:bg-red-600/20 text-red-400 transition-colors"
          disabled={uploading}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-8 bg-slate-700/50 rounded-full flex items-center px-3">
            <div className="flex-1 flex items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary rounded-full transition-all"
                  style={{ height: `${Math.random() * 20 + 10}px` }}
                />
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400">{voiceMessageService.formatDuration(duration)}</span>
        </div>
        <button
          onClick={sendVoice}
          disabled={uploading}
          className="p-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 p-2 bg-red-600/20 rounded-full animate-pulse">
        <div className="flex items-center gap-2 flex-1 px-2">
          <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-white font-medium">Recording...</span>
          <span className="text-sm text-slate-300">{voiceMessageService.formatDuration(duration)}</span>
        </div>
        <button
          onClick={stopRecording}
          className="p-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="p-2.5 rounded-full hover:bg-primary/20 text-primary transition-colors"
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
