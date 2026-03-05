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
  private lastRecordingDuration: number = 0;
  private stopPromise: Promise<Blob> | null = null;
  private stopResolver: ((blob: Blob) => void) | null = null;
  private stopRejecter: ((error: Error) => void) | null = null;
  private readonly MAX_VOICE_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  /**
   * Start recording voice message
   */
  async startRecording(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Voice recording not available in server environment');
    }

    try {
      await this.ensureMicrophonePermission();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const optimalMimeType = this.getOptimalMimeType();
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = optimalMimeType
          ? new MediaRecorder(stream, { mimeType: optimalMimeType })
          : new MediaRecorder(stream);
      } catch (error) {
        // Fallback to default recorder if mime type is rejected by the browser
        mediaRecorder = new MediaRecorder(stream);
      }

      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.lastRecordingDuration = 0;
      this.mediaRecorder = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('[VoiceMessageService] Recorder error:', event);
      };

      // Collect data in small chunks for better compatibility on mobile browsers
      mediaRecorder.start(250);
      console.debug('[VoiceMessageService] Recording started');
    } catch (error) {
      console.error('[VoiceMessageService] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return blob
   */
  stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      throw new Error('No active recording');
    }

    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = new Promise<Blob>((resolve, reject) => {
      this.stopResolver = resolve;
      this.stopRejecter = reject;

      const recorder = this.mediaRecorder!;
      const mimeType = recorder.mimeType || this.getOptimalMimeType() || 'audio/webm';

      recorder.onstop = () => {
        try {
          this.lastRecordingDuration = Math.max(
            1,
            Math.ceil((Date.now() - this.recordingStartTime) / 1000)
          );
          const blob = new Blob(this.audioChunks, { type: mimeType });

          // Stop all audio tracks
          recorder.stream.getTracks().forEach(track => track.stop());

          console.debug('[VoiceMessageService] Recording stopped', { size: blob.size, type: mimeType });
          this.cleanupRecorder();
          resolve(blob);
        } catch (error) {
          this.cleanupRecorder();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      recorder.onerror = () => {
        const err = new Error('Audio recorder failed');
        this.cleanupRecorder();
        reject(err);
      };

      try {
        if (typeof recorder.requestData === 'function') {
          recorder.requestData();
        }
        recorder.stop();
      } catch (error) {
        this.cleanupRecorder();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    return this.stopPromise;
  }

  /**
   * Abort recording without saving
   */
  abortRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {
        // ignore
      }
    }
    if (this.mediaRecorder?.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.cleanupRecorder();
  }

  /**
   * Upload voice message to storage with retry logic
   */
  async uploadVoiceMessage(
    audioBlob: Blob,
    path: string,
    onProgress?: (progress: number) => void
  ): Promise<VoiceMessageData> {
    try {
      if (audioBlob.size > this.MAX_VOICE_MESSAGE_SIZE_BYTES) {
        throw new Error('Voice message is too large. Please keep it under 10MB.');
      }

      const duration = this.lastRecordingDuration || Math.ceil((Date.now() - this.recordingStartTime) / 1000);
      const mimeType = audioBlob.type || this.getOptimalMimeType() || 'audio/webm';
      const extension = this.getFileExtension(mimeType);
      const fileName = `voice_${Date.now()}.${extension}`;
      const file = new File([audioBlob], fileName, { type: mimeType });

      const fullPath = path || `uploads/voice_messages/${Date.now()}_${file.name}`;

      console.log('[VoiceMessageService] Starting upload:', {
        path: fullPath,
        size: audioBlob.size,
        mimeType,
        duration
      });

      let url: string | null = null;
      let lastError: Error | null = null;

      // Retry up to 3 times with exponential backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          url = await uploadFile(file, fullPath, onProgress);
          console.log('[VoiceMessageService] ✅ Upload successful on attempt', attempt);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn('[VoiceMessageService] Upload attempt', attempt, 'failed:', lastError.message);

          // Don't retry if it's a permission error
          if ((error as any).code === 'storage/unauthorized' || (error as any).code === 'permission-denied') {
            console.error('[VoiceMessageService] Permission denied, not retrying');
            throw lastError;
          }

          // Wait before retry with exponential backoff
          if (attempt < 3) {
            const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            console.log(`[VoiceMessageService] Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      if (!url) {
        throw lastError || new Error('Failed to upload voice message after 3 attempts');
      }

      const voiceData: VoiceMessageData = {
        url,
        duration,
        size: audioBlob.size,
        mimeType,
        uploadedAt: Date.now(),
      };

      console.log('[VoiceMessageService] Voice message uploaded successfully:', voiceData);
      return voiceData;
    } catch (error) {
      console.error('[VoiceMessageService] ❌ Upload failed:', error);
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

      try {
        await audio.play();
      } catch (playError: any) {
        if (playError?.name === 'NotAllowedError') {
          // Browser autoplay policy: this is expected until user interacts.
          console.debug('[VoiceMessageService] Playback blocked by autoplay policy until user interaction.');
          return;
        }
        throw playError;
      }
      console.debug('[VoiceMessageService] Playing voice message:', url);
    } catch (error) {
      if ((error as any)?.name === 'NotAllowedError') {
        // Keep this silent at runtime; UI can still allow manual replay.
        return;
      }
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
  private getOptimalMimeType(): string | undefined {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mpeg',
    ];

    for (const mimeType of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return undefined;
  }

  /**
   * Resolve file extension based on MIME type
   */
  private getFileExtension(mimeType: string): string {
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }

  /**
   * Ensure microphone permission is available (best-effort)
   */
  private async ensureMicrophonePermission(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    try {
      if ('permissions' in navigator && (navigator as any).permissions?.query) {
        const status = await (navigator as any).permissions.query({ name: 'microphone' });
        if (status?.state === 'denied') {
          const err = new Error('Microphone permission denied');
          (err as any).name = 'NotAllowedError';
          throw err;
        }
      }
    } catch (_) {
      // Permission API not supported or blocked; proceed to getUserMedia
    }
  }

  /**
   * Cleanup recorder state
   */
  private cleanupRecorder(): void {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stopPromise = null;
    this.stopResolver = null;
    this.stopRejecter = null;
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
