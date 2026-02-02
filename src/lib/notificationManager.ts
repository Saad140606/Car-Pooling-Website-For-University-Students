/**
 * Real-time Notification Manager
 * Handles FCM notifications, displays them with badges, and triggers UI updates
 */

import { getMessaging, onMessage, type MessagePayload } from 'firebase/messaging';

export interface NotificationPayload {
  type: 'chat' | 'ride_request' | 'ride_accepted' | 'ride_confirmed' | 'ride_cancelled' | 'booking_status' | 'call_incoming';
  title: string;
  body: string;
  relatedId: string;
  relatedChatId?: string;
  relatedRideId?: string;
  senderId?: string;
  senderName?: string;
  icon?: string;
  sound?: string;
}

class NotificationManager {
  private listeners: Set<(payload: NotificationPayload) => void> = new Set();
  private notificationCounts: Map<string, number> = new Map();
  private soundUrl: string = '/notification-sound.mp3';

  /**
   * Subscribe to notification events
   */
  subscribe(callback: (payload: NotificationPayload) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit notification to all subscribers
   */
  private emit(payload: NotificationPayload): void {
    this.listeners.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error('[NotificationManager] Callback error:', error);
      }
    });
  }

  /**
   * Play notification sound
   */
  private playSound(): void {
    if (typeof window === 'undefined') return;

    try {
      const audio = new Audio(this.soundUrl);
      audio.volume = 0.5;
      audio.play().catch(() => {
        console.debug('[NotificationManager] Could not play notification sound');
      });
    } catch (error) {
      console.debug('[NotificationManager] Sound play error:', error);
    }
  }

  /**
   * Show system notification
   */
  private showSystemNotification(payload: NotificationPayload): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission !== 'granted') return;

    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/logo.png',
        badge: '/badge.png',
        tag: payload.relatedId,
        requireInteraction: payload.type === 'call_incoming', // Keep call notifications visible
      });

      // Click handler for notification
      notification.onclick = () => {
        window.focus();
        
        // Route based on notification type
        if (payload.type === 'chat' && payload.relatedChatId) {
          window.location.href = `/dashboard/chat/${payload.relatedChatId}`;
        } else if (payload.relatedRideId) {
          window.location.href = `/dashboard/rides/${payload.relatedRideId}`;
        }

        notification.close();
      };
    } catch (error) {
      console.debug('[NotificationManager] Failed to show system notification:', error);
    }
  }

  /**
   * Show browser badge
   */
  private updateBadge(count: number): void {
    if (typeof window === 'undefined' || !('setAppBadge' in navigator)) return;

    try {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    } catch (error) {
      console.debug('[NotificationManager] Badge update failed:', error);
    }
  }

  /**
   * Increment notification count for a specific type
   */
  incrementCount(type: string): void {
    const current = this.notificationCounts.get(type) || 0;
    this.notificationCounts.set(type, current + 1);
    this.updateBadge(this.getTotalCount());
  }

  /**
   * Decrement notification count
   */
  decrementCount(type: string): void {
    const current = this.notificationCounts.get(type) || 0;
    if (current > 0) {
      this.notificationCounts.set(type, current - 1);
    }
    this.updateBadge(this.getTotalCount());
  }

  /**
   * Get count for specific notification type
   */
  getCount(type: string): number {
    return this.notificationCounts.get(type) || 0;
  }

  /**
   * Get total notification count
   */
  getTotalCount(): number {
    let total = 0;
    this.notificationCounts.forEach(count => {
      total += count;
    });
    return total;
  }

  /**
   * Handle FCM message
   */
  handleFCMMessage(payload: MessagePayload): void {
    if (!payload.data) return;

    const notificationData = payload.data as any;
    const notificationPayload: NotificationPayload = {
      type: (notificationData.type || 'chat') as any,
      title: notificationData.title || 'Notification',
      body: notificationData.body || '',
      relatedId: notificationData.relatedId || `notif_${Date.now()}`,
      relatedChatId: notificationData.relatedChatId,
      relatedRideId: notificationData.relatedRideId,
      senderId: notificationData.senderId,
      senderName: notificationData.senderName,
      icon: notificationData.icon,
    };

    console.debug('[NotificationManager] Received FCM:', notificationPayload);

    // Play sound for important notifications
    if (
      notificationPayload.type === 'call_incoming' ||
      notificationPayload.type === 'ride_accepted' ||
      notificationPayload.type === 'ride_confirmed'
    ) {
      this.playSound();
    }

    // Show system notification
    this.showSystemNotification(notificationPayload);

    // Increment badge count
    this.incrementCount(notificationPayload.type);

    // Emit to all subscribers (UI components)
    this.emit(notificationPayload);
  }

  /**
   * Initialize FCM listener
   */
  initFCMListener(): void {
    if (typeof window === 'undefined') return;
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      console.debug('[NotificationManager] VAPID key missing');
      return;
    }

    try {
      const messaging = getMessaging();
      onMessage(messaging, (payload: MessagePayload) => {
        this.handleFCMMessage(payload);
      });
      console.debug('[NotificationManager] FCM listener initialized');
    } catch (error) {
      console.warn('[NotificationManager] FCM listener init failed:', error);
    }

    // Listen for custom FCM events dispatched by other code
    window.addEventListener('fcm_message', ((event: CustomEvent) => {
      this.handleFCMMessage(event.detail);
    }) as EventListener);

  }

  /**
   * Clear all counts
   */
  clearAllCounts(): void {
    this.notificationCounts.clear();
    this.updateBadge(0);
  }

  /**
   * Clear count for specific type
   */
  clearCount(type: string): void {
    this.notificationCounts.delete(type);
    this.updateBadge(this.getTotalCount());
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
