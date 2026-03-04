/**
 * FCM Token Manager
 * 
 * Handles registration, refresh, and cleanup of Firebase Cloud Messaging tokens.
 * This is CRITICAL for push notifications to work.
 */

import { getMessaging, getToken, deleteToken } from 'firebase/messaging';
import { Firestore, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export class FCMTokenManager {
  private userId: string | null = null;
  private firestore: Firestore | null = null;
  private tokenRefreshInterval: number | null = null;

  /**
   * Initialize the token manager
   */
  async initialize(firestore: Firestore, userId: string): Promise<void> {
    if (!VAPID_KEY) {
      console.warn('[FCMTokenManager] VAPID key not configured. Push notifications disabled.');
      return;
    }

    this.firestore = firestore;
    this.userId = userId;

    console.log('[FCMTokenManager] Initializing for user:', userId);

    try {
      if (!('Notification' in window)) {
        console.warn('[FCMTokenManager] Notification API not supported in this browser.');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.log('[FCMTokenManager] Notification permission not granted yet. Skipping token registration.');
        return;
      }

      // Get and register the initial token
      await this.registerToken();

      // Setup periodic token refresh check (every 30 minutes)
      this.setupTokenRefreshCheck();
    } catch (error) {
      console.error('[FCMTokenManager] Failed to initialize:', error);
      // Don't throw - this is non-critical for app functionality
    }
  }

  /**
   * Register the current FCM token
   */
  private async registerToken(): Promise<void> {
    if (!this.userId || !this.firestore) return;

    try {
      const messaging = getMessaging();
      const registration = await this.getServiceWorkerRegistration();
      
      // Get the FCM token
      // Use the main PWA service worker to avoid scope conflicts.
      let token: string | null = null;
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
      } catch (err) {
        // Handle AbortError/storage errors which can happen in some dev
        // environments (disabled storage, incognito, corrupted subscription)
        console.warn('[FCMTokenManager] getToken failed:', err);

        const isAbort = (err as any)?.name === 'AbortError' || String(err).toLowerCase().includes('storage');
        if (isAbort && registration) {
          try {
            // Attempt to clean up any stale push subscription and retry once
            const sub = await registration.pushManager.getSubscription().catch(() => null);
            if (sub) {
              console.warn('[FCMTokenManager] Unsubscribing stale push subscription to clear storage');
              await sub.unsubscribe().catch(() => {});
            }
            // Try again without explicitly passing the registration (let FCM manage it)
            token = await getToken(messaging, { vapidKey: VAPID_KEY });
          } catch (err2) {
            console.warn('[FCMTokenManager] Retry getToken also failed:', err2);
          }
        }
      }

      if (!token && registration) {
        try {
          const existingSubscription = await registration.pushManager.getSubscription();
          if (existingSubscription) {
            await existingSubscription.unsubscribe();
            token = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: registration,
            });
          }
        } catch (_) {}
      }

      if (!token) {
        console.warn('[FCMTokenManager] Failed to get FCM token. This may indicate:');
        console.warn('  1. Service worker not registered');
        console.warn('  2. Notification permission denied');
        console.warn('  3. Browser doesn\'t support FCM');
        return;
      }

      console.log('[FCMTokenManager] Got FCM token:', token.substring(0, 20) + '...');

      // Store token in Firestore
      const tokenDocRef = doc(this.firestore, 'fcm_tokens', this.userId);
      await setDoc(tokenDocRef, {
        token,
        registeredAt: Timestamp.now(),
        platform: this.getPlatformInfo(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      }, { merge: true });

      // Spark-compatible external-worker structure:
      // Also mirror token to `users/{uid}.fcmToken`.
      const userDocRef = doc(this.firestore, 'users', this.userId);
      await setDoc(userDocRef, {
        fcmToken: token,
        fcmTokenUpdatedAt: Timestamp.now(),
      }, { merge: true });

      console.log('[FCMTokenManager] ✅ Token registered in Firestore');

      // Also store in localStorage as backup
      this.storeTokenLocally(token);
    } catch (error) {
      console.error('[FCMTokenManager] Failed to register token:', error);
      if ((error as any).code === 'messaging/unsupported-browser') {
        console.warn('[FCMTokenManager] Browser does not support FCM');
      } else if ((error as any).code === 'permission-denied') {
        console.warn('[FCMTokenManager] User denied notification permission');
      }
    }
  }

  /**
   * Setup periodic token refresh check (every 30 minutes)
   */
  private setupTokenRefreshCheck(): void {
    if (!this.userId || !this.firestore) return;

    // Clear existing interval if any
    if (this.tokenRefreshInterval !== null) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Check for token refresh every 30 minutes
    this.tokenRefreshInterval = window.setInterval(async () => {
      console.log('[FCMTokenManager] Checking for token refresh...');
      try {
        await this.registerToken();
      } catch (error) {
        console.warn('[FCMTokenManager] Token refresh check failed:', error);
      }
    }, 30 * 60 * 1000) as unknown as number;

    console.log('[FCMTokenManager] Token refresh check scheduled (every 30 min)');
  }

  /**
   * Cleanup on user logout
   */
  async cleanup(): Promise<void> {
    if (!this.userId || !this.firestore) return;

    console.log('[FCMTokenManager] Cleaning up for user:', this.userId);

    try {
      // Clear token refresh interval
      if (this.tokenRefreshInterval !== null) {
        clearInterval(this.tokenRefreshInterval);
        this.tokenRefreshInterval = null;
      }

      // Only attempt Firestore cleanup if user is still authenticated as the same uid.
      // During logout transitions, writes can fail with permission-denied.
      const auth = getAuth();
      const canWrite = auth.currentUser?.uid === this.userId;

      if (canWrite) {
        const tokenDocRef = doc(this.firestore, 'fcm_tokens', this.userId);
        await deleteDoc(tokenDocRef);

        const userDocRef = doc(this.firestore, 'users', this.userId);
        await setDoc(userDocRef, {
          fcmToken: null,
          fcmTokenUpdatedAt: Timestamp.now(),
        }, { merge: true });
      }

      console.log('[FCMTokenManager] Token cleaned up from Firestore');

      // Clear local storage
      this.clearTokenLocally();
    } catch (error) {
      const code = (error as any)?.code;
      if (code !== 'permission-denied') {
        console.warn('[FCMTokenManager] Error during cleanup:', error);
      }
    }

    this.userId = null;
    this.firestore = null;
  }

  /**
   * Get service worker registration
   */
  private async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    try {
      const legacyRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (legacyRegistration) {
        await legacyRegistration.unregister().catch(() => {});
      }

      const waitForActiveWorker = async (registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> => {
        if (registration.active) {
          return registration;
        }

        try {
          await navigator.serviceWorker.ready;
        } catch (_) {}

        if (registration.active) {
          return registration;
        }

        await new Promise<void>((resolve) => {
          const sw = registration.installing || registration.waiting;
          if (!sw) {
            window.setTimeout(resolve, 250);
            return;
          }
          const done = () => resolve();
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') done();
          });
          window.setTimeout(done, 1500);
        });

        return registration;
      };

      const existingRootRegistration = await navigator.serviceWorker.getRegistration('/');
      if (existingRootRegistration) {
        return await waitForActiveWorker(existingRootRegistration);
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      console.log('[FCMTokenManager] Service worker registered for FCM:', registration.scope);
      return await waitForActiveWorker(registration);
    } catch (error) {
      console.warn('[FCMTokenManager] Failed to register service worker:', error);
      return undefined;
    }
  }

  /**
   * Get platform information for debugging
   */
  private getPlatformInfo(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
  }

  /**
   * Store token locally as backup
   */
  private storeTokenLocally(token: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`fcm_token_${this.userId}`, token);
        localStorage.setItem('fcm_token_timestamp', String(Date.now()));
      }
    } catch (_) {
      // Storage might be unavailable
    }
  }

  /**
   * Clear local token storage
   */
  private clearTokenLocally(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`fcm_token_${this.userId}`);
      }
    } catch (_) {
      // Storage might be unavailable
    }
  }

  /**
   * Manually request a new token (for testing or forced refresh)
   */
  async refreshToken(): Promise<string | null> {
    console.log('[FCMTokenManager] Forcing token refresh...');
    try {
      const messaging = getMessaging();
      const newToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await this.getServiceWorkerRegistration(),
        forceRefresh: true,
      });

      if (newToken && this.userId && this.firestore) {
        const tokenDocRef = doc(this.firestore, 'fcm_tokens', this.userId);
        await setDoc(tokenDocRef, { token: newToken }, { merge: true });
        const userDocRef = doc(this.firestore, 'users', this.userId);
        await setDoc(userDocRef, { fcmToken: newToken, fcmTokenUpdatedAt: Timestamp.now() }, { merge: true });
        console.log('[FCMTokenManager] ✅ New token registered');
        return newToken;
      }
    } catch (error) {
      console.error('[FCMTokenManager] Failed to refresh token:', error);
    }
    return null;
  }
}

// Export singleton
export const fcmTokenManager = new FCMTokenManager();
