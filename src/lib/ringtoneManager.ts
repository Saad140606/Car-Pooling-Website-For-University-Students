/**
 * Ringtone Manager - Handles call ringtones and sounds
 * Plays ringtones even when app is in background
 */

export type SoundType = 'ringtone' | 'notification' | 'success' | 'error';

interface Sound {
  audio: HTMLAudioElement;
  playing: boolean;
  loop: boolean;
}

export class RingtoneManager {
  private static instance: RingtoneManager;
  private sounds: Map<string, Sound> = new Map();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private ringtoneUrl = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='; // Placeholder
  private notificationSoundUrl = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='; // Placeholder

  private constructor() {
    this.initializeSounds();
  }

  static getInstance(): RingtoneManager {
    if (!RingtoneManager.instance) {
      RingtoneManager.instance = new RingtoneManager();
    }
    return RingtoneManager.instance;
  }

  /**
   * Initialize sounds
   */
  private initializeSounds() {
    if (typeof window === 'undefined') return;

    try {
      // Create call ringtone sound
      const ringtone = new Audio();
      ringtone.preload = 'auto';
      ringtone.src = this.ringtoneUrl;
      ringtone.volume = 1;
      ringtone.crossOrigin = 'anonymous';
      this.sounds.set('ringtone', {
        audio: ringtone,
        playing: false,
        loop: true,
      });

      // Create notification sound
      const notification = new Audio();
      notification.preload = 'auto';
      notification.src = this.notificationSoundUrl;
      notification.volume = 0.5;
      notification.crossOrigin = 'anonymous';
      this.sounds.set('notification', {
        audio: notification,
        playing: false,
        loop: false,
      });

      console.log('[Ringtone] Sounds initialized');
    } catch (error) {
      console.error('[Ringtone] Failed to initialize sounds:', error);
    }
  }

  /**
   * Set custom ringtone URL (MP3/WAV/OGG)
   */
  setRingtoneUrl(url: string) {
    this.ringtoneUrl = url;
    const sound = this.sounds.get('ringtone');
    if (sound) {
      sound.audio.src = url;
      console.log('[Ringtone] Ringtone URL updated:', url);
    }
  }

  /**
   * Set custom notification sound URL
   */
  setNotificationSoundUrl(url: string) {
    this.notificationSoundUrl = url;
    const sound = this.sounds.get('notification');
    if (sound) {
      sound.audio.src = url;
      console.log('[Ringtone] Notification sound URL updated:', url);
    }
  }

  /**
   * Play ringtone for incoming call
   */
  async playRingtone(): Promise<void> {
    if (typeof window === 'undefined') return;

    const sound = this.sounds.get('ringtone');
    if (!sound) {
      console.warn('[Ringtone] Ringtone not available');
      return;
    }

    try {
      sound.audio.loop = true;
      sound.audio.currentTime = 0;
      await sound.audio.play();
      sound.playing = true;

      console.log('[Ringtone] Ringtone playing');
      this.emit('ringtone-started', { type: 'ringtone' });
    } catch (error) {
      console.error('[Ringtone] Failed to play ringtone:', error);
      this.emit('ringtone-error', { error, type: 'ringtone' });
    }
  }

  /**
   * Stop ringtone
   */
  stopRingtone(): void {
    const sound = this.sounds.get('ringtone');
    if (sound && sound.playing) {
      sound.audio.pause();
      sound.audio.currentTime = 0;
      sound.playing = false;

      console.log('[Ringtone] Ringtone stopped');
      this.emit('ringtone-stopped', { type: 'ringtone' });
    }
  }

  /**
   * Play notification sound
   */
  async playNotificationSound(): Promise<void> {
    if (typeof window === 'undefined') return;

    const sound = this.sounds.get('notification');
    if (!sound) {
      console.warn('[Ringtone] Notification sound not available');
      return;
    }

    try {
      sound.audio.loop = false;
      sound.audio.currentTime = 0;
      await sound.audio.play();
      sound.playing = true;

      console.log('[Ringtone] Notification sound playing');
      this.emit('sound-played', { type: 'notification' });
    } catch (error) {
      console.error('[Ringtone] Failed to play notification sound:', error);
      this.emit('sound-error', { error, type: 'notification' });
    }
  }

  /**
   * Vibrate device (for notifications)
   */
  vibrate(pattern: number | number[] = 200) {
    if (typeof window === 'undefined' || !navigator.vibrate) return;

    try {
      navigator.vibrate(pattern);
      console.log('[Ringtone] Vibration triggered:', pattern);
    } catch (error) {
      console.error('[Ringtone] Vibration failed:', error);
    }
  }

  /**
   * Stop vibration
   */
  stopVibration(): void {
    if (typeof window === 'undefined' || !navigator.vibrate) return;

    try {
      navigator.vibrate(0); // 0 stops vibration
      console.log('[Ringtone] Vibration stopped');
    } catch (error) {
      console.error('[Ringtone] Stop vibration failed:', error);
    }
  }

  /**
   * Trigger haptic feedback (iOS)
   */
  triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    try {
      // Try Haptics API if available
      if ((window as any).webkit?.messageHandlers?.haptic) {
        (window as any).webkit.messageHandlers.haptic.postMessage({ style });
      }
    } catch (error) {
      console.error('[Ringtone] Haptic feedback failed:', error);
    }
  }

  /**
   * Is ringtone playing
   */
  isRingtonePlaying(): boolean {
    const sound = this.sounds.get('ringtone');
    return sound?.playing ?? false;
  }

  /**
   * Get audio element by type
   */
  getAudio(type: SoundType): HTMLAudioElement | null {
    return this.sounds.get(type)?.audio ?? null;
  }

  /**
   * Subscribe to events
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)!.delete(callback);
    };
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error('[Ringtone] Event callback error:', error);
        }
      });
    }
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    this.sounds.forEach((sound, key) => {
      if (sound.playing) {
        sound.audio.pause();
        sound.audio.currentTime = 0;
        sound.playing = false;
      }
    });

    console.log('[Ringtone] All sounds stopped');
  }
}

// Export singleton
export const ringtoneManager = RingtoneManager.getInstance();

// Initialize with default ringtones (can be from CDN or public folder)
export function initializeRingtones() {
  if (typeof window === 'undefined') return;

  // Use public ringtone assets
  // Replace these with your actual ringtone files
  ringtoneManager.setRingtoneUrl('/sounds/incoming-call.mp3');
  ringtoneManager.setNotificationSoundUrl('/sounds/notification.mp3');
}
