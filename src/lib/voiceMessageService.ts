/**
 * Voice Message Service
 * Handles recording, uploading, and playing voice messages
 */

import { uploadFile } from '@/firebase/storage/upload';

export interface VoiceMessageData {
  url: string;
  duration: number;
  size: number;
  mimeType: string;
  uploadedAt: number;
}

class VoiceMessageService {
  private audioContexts: Map<string, AudioContext> = new Map();
  private audioPlayers: Map<string, HTMLAudioElement> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime: number = 0;

  /**
   * Start recording voice message
   */
  async startRecording(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Voice recording not available in server environment');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getOptimalMimeType(),
      });

      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.mediaRecorder = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      mediaRecorder.start();
      console.debug('[VoiceMessageService] Recording started');
    } catch (error) {
      console.error('[VoiceMessageService] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return blob
   */
  stopRecording(): Blob {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      throw new Error('No active recording');
    }

    this.mediaRecorder.stop();
    const mimeType = this.mediaRecorder.mimeType;
    const blob = new Blob(this.audioChunks, { type: mimeType });

    // Stop all audio tracks
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

    console.debug('[VoiceMessageService] Recording stopped', { size: blob.size, type: mimeType });
    return blob;
  }

  /**
   * Upload voice message to storage
   */
  async uploadVoiceMessage(
    audioBlob: Blob,
    path: string,
    onProgress?: (progress: number) => void
  ): Promise<VoiceMessageData> {
    try {
      const duration = Math.ceil((Date.now() - this.recordingStartTime) / 1000);
      const file = new File(
        [audioBlob],
        `voice_${Date.now()}.webm`,
        { type: audioBlob.type }
      );

      const fullPath = path || `uploads/voice_messages/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, fullPath, onProgress);

      const voiceData: VoiceMessageData = {
        url,
        duration,
        size: audioBlob.size,
        mimeType: audioBlob.type,
        uploadedAt: Date.now(),
      };

      console.debug('[VoiceMessageService] Voice message uploaded:', voiceData);
      return voiceData;
    } catch (error) {
      console.error('[VoiceMessageService] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Play voice message
   */
  async playVoiceMessage(
    url: string,
    messageId?: string,
    onEnded?: () => void
  ): Promise<void> {
    try {
      // Check if already playing
      const existingPlayer = messageId ? this.audioPlayers.get(messageId) : null;
      if (existingPlayer && !existingPlayer.paused) {
        existingPlayer.pause();
        existingPlayer.currentTime = 0;
        return;
      }

      const audio = new Audio(url);
      audio.preload = 'auto';

      if (messageId) {
        this.audioPlayers.set(messageId, audio);
      }

      audio.onended = () => {
        onEnded?.();
      };

      audio.onerror = (error) => {
        console.error('[VoiceMessageService] Playback error:', error);
      };

      await audio.play();
      console.debug('[VoiceMessageService] Playing voice message:', url);
    } catch (error) {
      console.error('[VoiceMessageService] Failed to play voice message:', error);
      throw error;
    }
  }

  /**
   * Pause/stop voice message playback
   */
  pauseVoiceMessage(messageId?: string): void {
    if (messageId) {
      const player = this.audioPlayers.get(messageId);
      if (player) {
        player.pause();
        player.currentTime = 0;
      }
    }
  }

  /**
   * Get playback duration
   */
  async getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = reject;
    });
  }

  /**
   * Get optimal MIME type for recording
   */
  private getOptimalMimeType(): string {
    const mimeTypes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Check if voice recording is supported
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(navigator.mediaDevices?.getUserMedia && MediaRecorder);
  }

  /**
   * Format duration in mm:ss format
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export const voiceMessageService = new VoiceMessageService();
