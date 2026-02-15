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

import { Firestore, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { ActivityIndicatorState, ActivityIndicatorTimestamps } from '@/types/activityIndicator';
import { ACTIVITY_STORAGE_KEY, LAST_VIEWED_STORAGE_KEY } from '@/types/activityIndicator';

type ActivityCallback = (state: ActivityIndicatorState) => void;

class ActivityIndicatorManager {
  private firestore: Firestore | null = null;
  private userId: string | null = null;
  private university: string | null = null;
  private listeners: (() => void)[] = [];
  private callbacks: ActivityCallback[] = [];
  private state: ActivityIndicatorState = {
    bookings: false,
    rides: false,
    chat: false,
  };
  private lastViewed: ActivityIndicatorTimestamps = {};
  private initialized = false;

  /**
   * Initialize the activity indicator manager
   */
  initialize(firestore: Firestore, userId: string, university: string) {
    if (this.initialized && this.userId === userId && this.university === university) {
      return; // Already initialized for this user
    }

    this.firestore = firestore;
    this.userId = userId;
    this.university = university;

    // Load persisted state
    this.loadPersistedState();

    // Start listening for activity
    this.setupListeners();

    this.initialized = true;
  }

  /**
   * Load persisted activity state from localStorage
   */
  private loadPersistedState() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      const viewed = localStorage.getItem(LAST_VIEWED_STORAGE_KEY);

      if (stored) {
        this.state = JSON.parse(stored);
      }
      if (viewed) {
        this.lastViewed = JSON.parse(viewed);
      }
    } catch (error) {
      console.error('[ActivityIndicator] Failed to load persisted state:', error);
    }
  }

  /**
   * Persist activity state to localStorage
   */
  private persistState() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(this.state));
      localStorage.setItem(LAST_VIEWED_STORAGE_KEY, JSON.stringify(this.lastViewed));
    } catch (error) {
      console.error('[ActivityIndicator] Failed to persist state:', error);
    }
  }

  /**
   * Setup Firestore listeners for activity tracking
   */
  private setupListeners() {
    if (!this.firestore || !this.userId || !this.university) return;

    console.log('[ActivityIndicator] Setting up listeners for user:', this.userId);

    // Listen for bookings activity
    this.setupBookingsListener();

    // Listen for rides activity
    this.setupRidesListener();

    // Listen for chat activity
    this.setupChatListener();
  }

  /**
   * Listen for new bookings or booking status changes
   * Triggers when:
   * - New booking created
   * - Booking status changed (confirmed/rejected/cancelled)
   * - Driver interaction on booking
   */
  private setupBookingsListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    const bookingsRef = collection(this.firestore, 'universities', this.university, 'bookings');
    const q = query(
      bookingsRef,
      where('passengerId', '==', this.userId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Check if there are new or changed bookings since last view
        const bookingsLastViewed = this.lastViewed.bookingsLastViewed || 0;
        let hasNewActivity = false;

        snapshot.docs.forEach((doc) => {
          const booking = doc.data();
          const createdAt = booking.createdAt?.toMillis?.() || 0;
          const updatedAt = booking.updatedAt?.toMillis?.() || 0;
          const maxTime = Math.max(createdAt, updatedAt);

          // Activity is new if created/updated after last view
          if (maxTime > bookingsLastViewed) {
            hasNewActivity = true;
          }
        });

        if (hasNewActivity && this.state.bookings !== true) {
          this.state.bookings = true;
          this.persistState();
          this.notifyCallbacks();
          console.log('[ActivityIndicator] Bookings activity detected');
        }
      },
      (error) => {
        console.error('[ActivityIndicator] Bookings listener error:', error);
      }
    );

    this.listeners.push(unsubscribe);
  }

  /**
   * Listen for new rides or ride status changes
   * Triggers when:
   * - Passenger confirms booking
   * - Passenger cancels
   * - Ride status changes
   * - Driver interaction occurs
   */
  private setupRidesListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    const ridesRef = collection(this.firestore, 'universities', this.university, 'rides');
    const q = query(
      ridesRef,
      where('driverId', '==', this.userId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ridesLastViewed = this.lastViewed.ridesLastViewed || 0;
        let hasNewActivity = false;

        snapshot.docs.forEach((doc) => {
          const ride = doc.data();
          const createdAt = ride.createdAt?.toMillis?.() || 0;
          const updatedAt = ride.updatedAt?.toMillis?.() || 0;
          const maxTime = Math.max(createdAt, updatedAt);

          // Check for passenger confirmations or changes
          const confirmedPassengers = ride.confirmedPassengers || [];
          const passengerUpdated = confirmedPassengers.some((p: any) => 
            (p.confirmedAt?.toMillis?.() || 0) > ridesLastViewed
          );

          if ((maxTime > ridesLastViewed || passengerUpdated) && maxTime > 0) {
            hasNewActivity = true;
          }
        });

        if (hasNewActivity && this.state.rides !== true) {
          this.state.rides = true;
          this.persistState();
          this.notifyCallbacks();
          console.log('[ActivityIndicator] Rides activity detected');
        }
      },
      (error) => {
        console.error('[ActivityIndicator] Rides listener error:', error);
      }
    );

    this.listeners.push(unsubscribe);
  }

  /**
   * Listen for new unread messages in chat
   * Triggers when new message arrives or read status changes
   */
  private setupChatListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    // First, get user's chat list
    const chatsRef = collection(this.firestore, 'universities', this.university, 'chats');
    
    // Query chats where user is participant
    const q = query(
      chatsRef,
      where('participants', 'array-contains', this.userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatLastViewed = this.lastViewed.chatLastViewed || 0;
        let hasUnreadMessages = false;

        snapshot.docs.forEach((doc) => {
          const chat = doc.data();
          const messages = chat.messages || [];
          const participants = chat.participants || [];

          // Find this user's read status
          const userReadStatus = participants.find((p: any) => p.userId === this.userId);
          const userReadAt = userReadStatus?.readAt?.toMillis?.() || 0;

          // Check if there are unread messages
          const hasUnread = messages.some((msg: any) => {
            const msgTime = msg.createdAt?.toMillis?.() || 0;
            return msgTime > Math.max(userReadAt, chatLastViewed);
          });

          if (hasUnread) {
            hasUnreadMessages = true;
          }
        });

        if (hasUnreadMessages && this.state.chat !== true) {
          this.state.chat = true;
          this.persistState();
          this.notifyCallbacks();
          console.log('[ActivityIndicator] Chat activity detected');
        }
      },
      (error) => {
        console.error('[ActivityIndicator] Chat listener error:', error);
      }
    );

    this.listeners.push(unsubscribe);
  }

  /**
   * Clear activity indicator for a specific section
   * Called when user navigates to that section
   */
  markAsViewed(section: 'bookings' | 'rides' | 'chat') {
    const now = Date.now();

    switch (section) {
      case 'bookings':
        this.state.bookings = false;
        this.lastViewed.bookingsLastViewed = now;
        break;
      case 'rides':
        this.state.rides = false;
        this.lastViewed.ridesLastViewed = now;
        break;
      case 'chat':
        this.state.chat = false;
        this.lastViewed.chatLastViewed = now;
        break;
    }

    this.persistState();
    this.notifyCallbacks();
    console.log(`[ActivityIndicator] Marked ${section} as viewed`);
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
    this.callbacks.forEach((callback) => {
      try {
        callback({ ...this.state });
      } catch (error) {
        console.error('[ActivityIndicator] Callback error:', error);
      }
    });
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
    this.initialized = false;
    console.log('[ActivityIndicator] Cleaned up listeners');
  }

  /**
   * Reset all activity indicators
   */
  reset() {
    this.state = {
      bookings: false,
      rides: false,
      chat: false,
    };
    this.persistState();
    this.notifyCallbacks();
  }
}

// Export singleton instance
export const activityIndicatorManager = new ActivityIndicatorManager();
