import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, AlertCircle } from 'lucide-react';
import { voiceMessageService } from '@/lib/voiceMessageService';

export default function VoiceRecorder({ onSend, disabled = false }: { onSend: (url: string) => Promise<any> | any; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const MAX_RETRIES = 3;

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
      abortControllerRef.current?.abort();
    };
  }, []);

  const startRecording = async () => {
    if (disabled) return;
    try {
      setError(null);
      setRetryCount(0);
      
      if (!voiceMessageService.isSupported()) {
        setError('Voice recording is not supported. Please use Chrome, Firefox, or Edge.');
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
        setError('Microphone permission denied. Please enable microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect one and try again.');
      } else {
        setError(err.message || 'Failed to start recording. Please check your microphone.');
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
      setError('Failed to stop recording. Please try again.');
    }
  };

  const cancelRecording = () => {
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setUploadProgress(0);
  };

  const uploadWithRetry = async (
    audioBlob: Blob,
    attempt: number = 0
  ): Promise<any> => {
    try {
      abortControllerRef.current = new AbortController();
      
      console.debug('[VoiceRecorder] Upload attempt:', attempt + 1);
      
      const voiceData = await voiceMessageService.uploadVoiceMessage(
        audioBlob,
        '',
        (progress) => setUploadProgress(Math.min(progress, 99))
      );
      
      setUploadProgress(100);
      console.debug('[VoiceRecorder] Upload successful:', voiceData);
      return voiceData;
    } catch (err: any) {
      console.error(`[VoiceRecorder] Upload attempt ${attempt + 1} failed:`, err);
      
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        setError(`Upload failed. Retrying in ${delay / 1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        setRetryCount(attempt + 1);
        return uploadWithRetry(audioBlob, attempt + 1);
      }
      
      throw new Error(
        err?.message || 
        'Failed to upload voice message after multiple attempts. Check your connection.'
      );
    }
  };

  const sendVoice = async () => {
    if (disabled) return;
    if (!audioBlob) return;
    
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      const voiceData = await uploadWithRetry(audioBlob);
      
      console.debug('[VoiceRecorder] Sending voice message:', voiceData);
      
      // Ensure callback completes before cleanup
      await onSend(voiceData.url);
      
      // Clear state after successful send
      setAudioBlob(null);
      setDuration(0);
      setUploadProgress(0);
    } catch (err: any) {
      console.error('[VoiceRecorder] Failed to send voice:', err);
      setError(err.message || 'Failed to send voice message. Please try again.');
      // Leave audioBlob intact so user can retry
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-full border border-red-500/30">
        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
        <span className="text-xs text-red-300 flex-1 truncate">{error}</span>
        <button
          onClick={() => {
            setError(null);
            setAudioBlob(null);
            setDuration(0);
          }}
          className="text-xs px-2 py-1 rounded bg-red-600/50 hover:bg-red-600 text-white transition-colors whitespace-nowrap flex-shrink-0"
        >
          Clear
        </button>
      </div>
    );
  }

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-full">
        <button
          onClick={cancelRecording}
          className="p-2 rounded-full hover:bg-red-600/20 text-red-400 transition-colors"
          disabled={uploading}
          title="Cancel"
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
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {voiceMessageService.formatDuration(duration)}
          </span>
        </div>
        {uploading && uploadProgress > 0 && (
          <span className="text-xs text-slate-300 min-w-[35px] text-right">
            {Math.round(uploadProgress)}%
          </span>
        )}
        <button
          onClick={sendVoice}
          disabled={uploading}
          className="p-2 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Send voice message"
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
          className="p-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors flex-shrink-0"
          title="Stop recording"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="p-2.5 rounded-full hover:bg-primary/20 text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
