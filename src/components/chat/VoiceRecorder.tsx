import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { uploadFile } from '@/firebase/storage/upload';

export default function VoiceRecorder({ onSend }: { onSend: (url: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice recording is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings to record voice messages.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Failed to start recording. Please check your microphone and browser permissions.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
  };

  const sendVoice = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const path = `uploads/chats/voice/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path, () => {});
      onSend(url);
      setAudioBlob(null);
      setDuration(0);
    } catch (err) {
      console.error('Failed to upload voice:', err);
      alert('Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <span className="text-xs text-slate-400">{formatTime(duration)}</span>
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
          <span className="text-sm text-slate-300">{formatTime(duration)}</span>
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
