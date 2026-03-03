'use client';

/**
 * Activity Indicator Service
 * 
 * Manages Firebase real-time listeners for activity tracking
 * across bookings, rides, and chat sections.
 * 
 * Features:
 * - Real-time activity detection via Firestore listeners
 * - Persistent state across browser reloads
 * - Automatic clearing when sections are visited
 * - Prevents duplicate listeners
 * - Efficient cleanup
 */

import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import type {
  ActivityIndicatorState,
  ActivitySection,
  UnreadActivityEvent,
} from '@/types/activityIndicator';

type ActivityCallback = (state: ActivityIndicatorState) => void;

const UNREAD_EVENTS_COLLECTION = 'unreadEvents';

const SECTION_NOTIFICATION_TYPE_MAP: Record<ActivitySection, string[] | null> = {
  rides: [
    'ride_request',
    'booking',
    'ride_confirmed',
    'request_confirmed',
    'request_cancelled',
    'passenger_cancelled',
    'passenger_cancelled_booking',
    'request_auto_cancelled',
    'ride_status',
    'lifecycle_passenger_cancelled',
  ],
  bookings: [
    'ride_accepted',
    'request_accepted',
    'ride_rejected',
    'request_rejected',
    'ride_started',
    'ride_cancelled',
    'confirm_reminder',
    'confirm_urgent_reminder',
    'ride_expired',
    'request_expired',
  ],
  analytics: ['ride_completed', 'completion_window'],
  chat: ['chat'],
  notifications: null,
};

function sanitizeForDocId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}

function mapNotificationToSection(notification: any): ActivitySection | null {
  const type = String(notification?.type || '').toLowerCase();

  if (type === 'chat') {
    return 'chat';
  }

  if ([
    'ride_accepted',
    'request_accepted',
    'ride_rejected',
    'request_rejected',
    'ride_started',
    'ride_cancelled',
    'confirm_reminder',
    'confirm_urgent_reminder',
    'ride_expired',
    'request_expired',
  ].includes(type)) {
    return 'bookings';
  }

  if ([
    'ride_request',
    'booking',
    'ride_status',
    'request_cancelled',
    'passenger_cancelled',
    'passenger_cancelled_booking',
    'lifecycle_passenger_cancelled',
    'ride_confirmed',
    'request_confirmed',
    'request_auto_cancelled',
  ].includes(type)) {
    return 'rides';
  }

  if (['ride_completed', 'completion_window'].includes(type)) {
    return 'analytics';
  }

  return 'notifications';
}

class ActivityIndicatorManager {
  private firestore: Firestore | null = null;
  private userId: string | null = null;
  private university: string | null = null;
  private listeners: (() => void)[] = [];
  private callbacks: ActivityCallback[] = [];
  private state: ActivityIndicatorState = {
    bookings: false,
    rides: false,
    analytics: false,
    chat: false,
    notifications: false,
  };
  private initialized = false;
  private callbackFlushScheduled = false;
  private inFlightEventWrites = new Set<string>();

  /**
   * Initialize the activity indicator manager
   */
  initialize(firestore: Firestore, userId: string, university: string) {
    if (this.initialized && this.userId === userId && this.university === university) {
      return; // Already initialized for this user
    }

    this.firestore = firestore;
    this.userId = userId;
    this.university = String(university || '').trim().toLowerCase();

    // Start listening for unread events + source notifications
    this.setupListeners();

    this.initialized = true;
  }

  /**
   * Setup Firestore listeners for unread activity tracking
   */
  private setupListeners() {
    if (!this.firestore || !this.userId || !this.university) return;

    console.log('[ActivityIndicator] Initializing unread-event listeners for user:', this.userId);
    this.setupUnreadEventsListener();
    this.setupNotificationBridgeListener();
  }

  /**
   * Source of truth for badge state: unread events collection
   */
  private setupUnreadEventsListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    const unreadRef = collection(this.firestore, 'universities', this.university, UNREAD_EVENTS_COLLECTION);
    const unreadQuery = query(
      unreadRef,
      where('userId', '==', this.userId),
      where('unreadFlag', '==', true)
    );

    const unsubscribe = onSnapshot(
      unreadQuery,
      (snapshot) => {
        const nextState: ActivityIndicatorState = {
          bookings: false,
          rides: false,
          analytics: false,
          chat: false,
          notifications: false,
        };

        snapshot.docs.forEach((eventDoc) => {
          const eventData = eventDoc.data() as UnreadActivityEvent;
          const section = eventData.targetSection;
          if (section && section in nextState) {
            nextState[section] = true;
          }
        });

        this.state = nextState;
        this.notifyCallbacks();
      },
      (error) => {
        console.error('[ActivityIndicator] Unread-events listener error:', error);
      }
    );

    this.listeners.push(unsubscribe);
  }

  /**
   * Bridge unread notifications -> unread activity events (deduped by event id)
   */
  private setupNotificationBridgeListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    const notificationsRef = collection(this.firestore, 'universities', this.university, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      where('userId', '==', this.userId),
      where('isRead', '==', false),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      async (snapshot) => {
        const derivedState: ActivityIndicatorState = {
          bookings: false,
          rides: false,
          analytics: false,
          chat: false,
          notifications: snapshot.docs.length > 0,
        };

        for (const notificationDoc of snapshot.docs) {
          const notification = notificationDoc.data();
          const mappedSection = mapNotificationToSection(notification);
          if (mappedSection && mappedSection in derivedState) {
            derivedState[mappedSection] = true;
          }

          const baseEventId = `notification:${notificationDoc.id}`;
          const detectedAt = notification?.createdAt || serverTimestamp();

          await this.ensureUnreadEvent(baseEventId, 'notifications', detectedAt, notificationDoc.id);

          if (mappedSection && mappedSection !== 'notifications') {
            await this.ensureUnreadEvent(baseEventId, mappedSection, detectedAt, notificationDoc.id);
          }
        }

        this.state = {
          bookings: this.state.bookings || derivedState.bookings,
          rides: this.state.rides || derivedState.rides,
          analytics: this.state.analytics || derivedState.analytics,
          chat: this.state.chat || derivedState.chat,
          notifications: this.state.notifications || derivedState.notifications,
        };
        this.notifyCallbacks();
      },
      (error) => {
        console.error('[ActivityIndicator] Notification bridge listener error:', error);
      }
    );

    this.listeners.push(unsubscribe);
  }

  /**
   * Deduplicated unread event upsert
   */
  private async ensureUnreadEvent(
    baseEventId: string,
    targetSection: ActivitySection,
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>,
    sourceNotificationId?: string
  ): Promise<void> {
    if (!this.firestore || !this.userId || !this.university) return;

    const logicalEventId = `${baseEventId}:${targetSection}`;
    const dedupeKey = `${this.userId}:${logicalEventId}`;
    if (this.inFlightEventWrites.has(dedupeKey)) return;

    this.inFlightEventWrites.add(dedupeKey);

    try {
      const unreadRef = collection(this.firestore, 'universities', this.university, UNREAD_EVENTS_COLLECTION);
      const eventDocId = sanitizeForDocId(dedupeKey);
      const eventRef = doc(unreadRef, eventDocId);
      const existing = await getDoc(eventRef);

      if (existing.exists()) {
        return;
      }

      await setDoc(eventRef, {
        eventId: logicalEventId,
        targetSection,
        userId: this.userId,
        unreadFlag: true,
        timestamp,
        sourceNotificationId: sourceNotificationId || null,
        createdAt: serverTimestamp(),
      } satisfies UnreadActivityEvent & Record<string, any>);
    } catch (error) {
      const code = String((error as any)?.code || '');
      const message = String((error as any)?.message || '').toLowerCase();
      if (code === 'permission-denied' || message.includes('permission')) {
        console.debug('[ActivityIndicator] Skipping unread event upsert due to permissions');
      } else {
        console.error('[ActivityIndicator] Failed to ensure unread event:', error);
      }
    } finally {
      this.inFlightEventWrites.delete(dedupeKey);
    }
  }

  private async markMappedNotificationsRead(section: ActivitySection) {
    if (!this.firestore || !this.userId || !this.university) return;

    const notificationsRef = collection(this.firestore, 'universities', this.university, 'notifications');
    const types = SECTION_NOTIFICATION_TYPE_MAP[section];
    const batch = writeBatch(this.firestore);

    if (!types) {
      const allUnreadQuery = query(
        notificationsRef,
        where('userId', '==', this.userId),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(allUnreadQuery);
      snapshot.docs.forEach((notificationDoc) => {
        batch.update(notificationDoc.ref, { isRead: true, readAt: serverTimestamp() });
      });
      if (!snapshot.empty) {
        await batch.commit();
      }
      return;
    }

    if (types.length === 0) {
      return;
    }

    const typedUnreadQuery = query(
      notificationsRef,
      where('userId', '==', this.userId),
      where('isRead', '==', false),
      where('type', 'in', types)
    );
    const snapshot = await getDocs(typedUnreadQuery);
    snapshot.docs.forEach((notificationDoc) => {
      batch.update(notificationDoc.ref, { isRead: true, readAt: serverTimestamp() });
    });
    if (!snapshot.empty) {
      await batch.commit();
    }
  }

  /**
   * Clear activity indicator for a specific section
   * Called when user navigates to that section
   */
  async markAsViewed(section: ActivitySection): Promise<void> {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      const unreadRef = collection(this.firestore, 'universities', this.university, UNREAD_EVENTS_COLLECTION);
      const unreadSectionQuery = query(
        unreadRef,
        where('userId', '==', this.userId),
        where('targetSection', '==', section),
        where('unreadFlag', '==', true)
      );

      const unreadSnapshot = await getDocs(unreadSectionQuery);
      const batch = writeBatch(this.firestore);

      unreadSnapshot.docs.forEach((eventDoc) => {
        batch.update(eventDoc.ref, {
          unreadFlag: false,
          readAt: serverTimestamp(),
        });
      });

      if (!unreadSnapshot.empty) {
        await batch.commit();
      }

      await this.markMappedNotificationsRead(section);
    } catch (error) {
      console.error(`[ActivityIndicator] Failed to mark ${section} as viewed:`, error);
    }
  }

  /**
   * Get current activity state
   */
  getState(): ActivityIndicatorState {
    return { ...this.state };
  }

  /**
   * Subscribe to activity state changes
   */
  subscribe(callback: ActivityCallback): () => void {
    this.callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifyCallbacks() {
    if (this.callbackFlushScheduled) return;
    this.callbackFlushScheduled = true;

    setTimeout(() => {
      this.callbackFlushScheduled = false;
      const snapshot = { ...this.state };

      this.callbacks.forEach((callback) => {
        try {
          callback(snapshot);
        } catch (error) {
          console.error('[ActivityIndicator] Callback error:', error);
        }
      });
    }, 16);
  }

  /**
   * Cleanup all listeners
   */
  cleanup() {
    this.listeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('[ActivityIndicator] Cleanup error:', error);
      }
    });
    this.listeners = [];
    this.callbacks = [];
    this.inFlightEventWrites.clear();
    this.initialized = false;
    console.log('[ActivityIndicator] Cleaned up listeners');
  }

  /**
   * Reset all activity indicators (marks all sections read)
   */
  async reset() {
    await Promise.all([
      this.markAsViewed('rides'),
      this.markAsViewed('bookings'),
      this.markAsViewed('analytics'),
      this.markAsViewed('chat'),
      this.markAsViewed('notifications'),
    ]);
  }
}

// Export singleton instance
export const activityIndicatorManager = new ActivityIndicatorManager();
