'use client';

/**
 * Post-Ride Workflow Manager Service
 * 
 * CRITICAL LIFECYCLE SYSTEM:
 * - Monitors rides for pending post-ride completion
 * - Detects when rides reach completion threshold (departure + trigger delay)
 * - Persists workflow state to Firestore
 * - Manages listener lifecycle and cleanup
 * - Provides network resilience with retry logic
 */

import { Firestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp, getDocs, getDoc } from 'firebase/firestore';
import type { PendingPostRideWorkflow, PostRideStatus, PostRideConfig } from '@/types/postRideWorkflow';
import { getPostRideConfig } from '@/types/postRideWorkflow';
import { parseTimestampToMs } from '@/lib/timestampUtils';

type WorkflowCallback = (workflows: PendingPostRideWorkflow[]) => void;

class PostRideManager {
  private firestore: Firestore | null = null;
  private userId: string | null = null;
  private university: string | null = null;
  private config: PostRideConfig;
  
  // Listeners
  private ridesListener: (() => void) | null = null;
  private bookingsListener: (() => void) | null = null;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  // Callbacks
  private callbacks: WorkflowCallback[] = [];
  
  // State tracking
  private pendingWorkflows: Map<string, PendingPostRideWorkflow> = new Map();
  private processedRideIds: Set<string> = new Set(); // Prevent duplicate processing
  private initialized = false;

  constructor() {
    this.config = getPostRideConfig();
    console.log('[PostRideManager] Initialized with config:', {
      triggerDelaySeconds: this.config.triggerDelaySeconds,
      environment: process.env.NODE_ENV,
    });
  }

  /**
   * Initialize the post-ride manager
   * Called once when user logs in
   */
  initialize(firestore: Firestore, userId: string, university: string) {
    if (this.initialized && this.userId === userId && this.university === university) {
      console.log('[PostRideManager] Already initialized for this user');
      return;
    }

    this.firestore = firestore;
    this.userId = userId;
    this.university = university;

    console.log('[PostRideManager] Initializing for user:', { userId, university });

    // Check for pending workflows on app load
    this.checkForPendingWorkflows();

    // Setup listeners for new rides
    this.setupRidesListener();

    this.initialized = true;
  }

  /**
   * Check for pending workflows on app load
   * Handles case where app was closed during workflow
   */
  private async checkForPendingWorkflows() {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      // Check rides where user is passenger with pending status
      const ridesRef = collection(this.firestore, 'universities', this.university, 'rides');
      const passengerQuery = query(ridesRef, where('passengers', 'array-contains', this.userId));
      const passengerRides = await getDocs(passengerQuery);

      for (const rideDoc of passengerRides.docs) {
        const rideData = rideDoc.data();
        const postRideStatus = rideData.postRideStatus as PostRideStatus | undefined;

        // If passenger workflow is pending, add to list
        if (postRideStatus?.pendingPassenger && !postRideStatus.passengerConfirmed) {
          const workflow: PendingPostRideWorkflow = {
            rideId: rideDoc.id,
            userId: this.userId,
            userRole: 'passenger',
            rideData: {
              id: rideDoc.id,
              driverId: rideData.driverId,
              passengerId: this.userId,
              departureTime: rideData.departureTime?.toDate?.() || new Date(),
              departureLocation: rideData.departureLocation,
              destinationLocation: rideData.destinationLocation,
            },
            university: this.university,
          };
          
          this.pendingWorkflows.set(`${rideDoc.id}-passenger`, workflow);
          this.processedRideIds.add(`${rideDoc.id}-passenger`);
          console.log('[PostRideManager] Found pending passenger workflow:', rideDoc.id);
        }
      }

      // Check rides where user is driver with pending status
      const driverQuery = query(ridesRef, where('driverId', '==', this.userId));
      const driverRides = await getDocs(driverQuery);

      for (const rideDoc of driverRides.docs) {
        const rideData = rideDoc.data();
        const postRideStatus = rideData.postRideStatus as PostRideStatus | undefined;

        // If driver workflow is pending, add to list
        if (postRideStatus?.pendingDriver && !postRideStatus.driverConfirmed) {
          const workflow: PendingPostRideWorkflow = {
            rideId: rideDoc.id,
            userId: this.userId,
            userRole: 'driver',
            rideData: {
              id: rideDoc.id,
              driverId: this.userId,
              passengerId: rideData.passengerId,
              departureTime: rideData.departureTime?.toDate?.() || new Date(),
              departureLocation: rideData.departureLocation,
              destinationLocation: rideData.destinationLocation,
              confirmedPassengers: rideData.confirmedPassengers?.map((p: any) => ({
                id: p.passengerId,
                name: p.name,
                email: p.email,
              })) || [],
            },
            university: this.university,
          };
          
          this.pendingWorkflows.set(`${rideDoc.id}-driver`, workflow);
          this.processedRideIds.add(`${rideDoc.id}-driver`);
          console.log('[PostRideManager] Found pending driver workflow:', rideDoc.id);
        }
      }

      // Notify subscribers
      if (this.pendingWorkflows.size > 0) {
        this.notifyCallbacks();
      }
    } catch (error) {
      console.error('[PostRideManager] Failed to check pending workflows:', error);
    }
  }

  /**
   * Setup listener for new rides
   * Watches for confirmed rides that need post-ride workflow
   */
  private setupRidesListener() {
    if (!this.firestore || !this.userId || !this.university) return;

    const ridesRef = collection(this.firestore, 'universities', this.university, 'rides');
    
    // Get rides where user is confirmed passenger or driver
    const passengerQuery = query(
      ridesRef,
      where('passengers', 'array-contains', this.userId)
    );

    this.ridesListener = onSnapshot(
      passengerQuery,
      (snapshot) => {
        console.log('[PostRideManager] Rides listener triggered, checking', snapshot.docs.length, 'rides');
        
        snapshot.docs.forEach((rideDoc) => {
          this.evaluateRideForWorkflow(rideDoc.id, rideDoc.data(), 'passenger');
        });
      },
      (error) => {
        console.error('[PostRideManager] Rides listener error:', error);
      }
    );

    // Also listen for driver rides
    const driverQuery = query(
      ridesRef,
      where('driverId', '==', this.userId)
    );

    this.bookingsListener = onSnapshot(
      driverQuery,
      (snapshot) => {
        console.log('[PostRideManager] Driver rides listener triggered, checking', snapshot.docs.length, 'rides');
        
        snapshot.docs.forEach((rideDoc) => {
          this.evaluateRideForWorkflow(rideDoc.id, rideDoc.data(), 'driver');
        });
      },
      (error) => {
        console.error('[PostRideManager] Driver rides listener error:', error);
      }
    );
  }

  /**
   * Evaluate if a ride needs post-ride workflow
   * Triggered when ride is fetched or updated
   */
  private evaluateRideForWorkflow(rideId: string, rideData: any, role: 'passenger' | 'driver') {
    const workflowKey = `${rideId}-${role}`;

    // Clean previous timer when ride updates to keep scheduling deterministic.
    const existingTimer = this.timers.get(workflowKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(workflowKey);
    }

    // Skip if already processed
    if (this.processedRideIds.has(workflowKey)) {
      return;
    }

    const departureMs = parseTimestampToMs(rideData?.departureTime, { silent: true });
    if (departureMs === null) return;

    const triggerAtMs = departureMs + this.config.triggerDelaySeconds * 1000;
    const nowMs = Date.now();

    const confirmedPassengers = Array.isArray(rideData?.confirmedPassengers)
      ? rideData.confirmedPassengers
      : [];

    const isPassengerConfirmed = confirmedPassengers.some((passenger: any) => {
      if (typeof passenger === 'string') return passenger === this.userId;
      const passengerId = String(passenger?.userId || passenger?.passengerId || passenger?.id || '');
      return passengerId === this.userId;
    });

    const shouldEvaluateForRole = role === 'driver'
      ? confirmedPassengers.length > 0
      : isPassengerConfirmed;

    if (!shouldEvaluateForRole) {
      return;
    }

    const postRideStatus = rideData.postRideStatus as PostRideStatus | undefined;
    const isCompletedPassenger = role === 'passenger' && postRideStatus?.passengerConfirmed;
    const isCompletedDriver = role === 'driver' && postRideStatus?.driverConfirmed;
    if (isCompletedPassenger || isCompletedDriver) {
      return;
    }

    const createWorkflow = () => {
      // Skip if already processed in the meantime.
      if (this.processedRideIds.has(workflowKey)) return;

      const departureTime = new Date(departureMs);

      const workflow: PendingPostRideWorkflow = {
        rideId,
        userId: this.userId!,
        userRole: role,
        rideData: {
          id: rideId,
          driverId: rideData.driverId,
          passengerId: rideData.passengerId || this.userId!,
          departureTime,
          departureLocation: rideData.departureLocation,
          destinationLocation: rideData.destinationLocation,
          confirmedPassengers: confirmedPassengers.map((p: any) => ({
            id: p?.passengerId || p?.userId || p?.id || p,
            name: p?.name || p?.passengerName || 'Passenger',
            email: p?.email || '',
          })),
        },
        university: this.university!,
      };

      this.pendingWorkflows.set(workflowKey, workflow);
      this.processedRideIds.add(workflowKey);
      this.notifyCallbacks();

      console.log('[PostRideManager] Created pending workflow:', {
        rideId,
        role,
        triggerAt: new Date(triggerAtMs).toISOString(),
      });

      this.markWorkflowPending(rideId, role).catch((error) => {
        console.error('[PostRideManager] Failed to mark workflow pending:', error);
      });
    };

    if (nowMs >= triggerAtMs) {
      createWorkflow();
      return;
    }

    const delayMs = Math.max(0, triggerAtMs - nowMs);
    const timer = setTimeout(() => {
      this.timers.delete(workflowKey);
      createWorkflow();
    }, delayMs);
    this.timers.set(workflowKey, timer);

    console.log('[PostRideManager] Scheduled workflow trigger:', {
      rideId,
      role,
      triggerAt: new Date(triggerAtMs).toISOString(),
      inSeconds: Math.round(delayMs / 1000),
    });
  }

  /**
   * Mark workflow as pending in Firestore
   * Ensures it will be shown on next app load if not completed
   */
  private async markWorkflowPending(rideId: string, role: 'passenger' | 'driver') {
    if (!this.firestore || !this.university) return;

    try {
      const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      const rideData = rideSnap.data();
      
      const updates: any = {
        postRideStatus: {
          ...rideData?.postRideStatus || {},
          createdAt: serverTimestamp(),
        },
      };

      if (role === 'passenger') {
        updates.postRideStatus.pendingPassenger = true;
      } else {
        updates.postRideStatus.pendingDriver = true;
      }

      await updateDoc(rideRef, updates);
      console.log('[PostRideManager] Marked workflow pending in Firestore:', { rideId, role });
    } catch (error) {
      console.error('[PostRideManager] Failed to mark workflow pending:', error);
    }
  }

  /**
   * Complete a workflow (passenger or driver submits)
   */
  async completeWorkflow(rideId: string, role: 'passenger' | 'driver', workflowData: any) {
    if (!this.firestore || !this.university) return;

    try {
      const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);

      // Read existing postRideStatus using modular Firestore
      const rideSnap = await getDoc(rideRef);
      const existingStatus = rideSnap.data()?.postRideStatus || {};

      const updates: any = {
        postRideStatus: {
          ...existingStatus,
          completedAt: serverTimestamp(),
        },
      };

      if (role === 'passenger') {
        updates.postRideStatus.passengerConfirmed = true;
        updates.postRideStatus.pendingPassenger = false;
        updates.postRideStatus.passengerOutcome = workflowData.outcome;
        updates.postRideStatus.passengerReason = workflowData.reason;
        updates.postRideStatus.passengerRating = workflowData.rating;
        updates.postRideStatus.passengerReview = workflowData.review;
      } else {
        updates.postRideStatus.driverConfirmed = true;
        updates.postRideStatus.pendingDriver = false;
        updates.postRideStatus.driverOutcome = workflowData.outcomes;
        updates.postRideStatus.driverReasons = workflowData.reasons;
        updates.postRideStatus.driverRatings = workflowData.ratings;
        updates.postRideStatus.driverReviews = workflowData.reviews;
      }

      await updateDoc(rideRef, updates);

      // Remove from pending workflows
      const workflowKey = `${rideId}-${role}`;
      this.pendingWorkflows.delete(workflowKey);

      console.log('[PostRideManager] Completed workflow:', { rideId, role });
      this.notifyCallbacks();

      return true;
    } catch (error) {
      console.error('[PostRideManager] Failed to complete workflow:', error);
      throw error;
    }
  }

  /**
   * Get all pending workflows
   */
  getPendingWorkflows(): PendingPostRideWorkflow[] {
    return Array.from(this.pendingWorkflows.values());
  }

  /**
   * Subscribe to workflow changes
   */
  subscribe(callback: WorkflowCallback): () => void {
    this.callbacks.push(callback);
    console.log('[PostRideManager] Subscriber added, total:', this.callbacks.length);

    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
      console.log('[PostRideManager] Subscriber removed, total:', this.callbacks.length);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifyCallbacks() {
    const workflows = this.getPendingWorkflows();
    this.callbacks.forEach((callback) => {
      try {
        callback(workflows);
      } catch (error) {
        console.error('[PostRideManager] Callback error:', error);
      }
    });
  }

  /**
   * Cleanup all listeners and timers
   */
  cleanup() {
    console.log('[PostRideManager] Cleaning up listeners and timers');

    // Unsubscribe from Firestore listeners
    if (this.ridesListener) {
      this.ridesListener();
    }
    if (this.bookingsListener) {
      this.bookingsListener();
    }

    // Clear timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    // Clear state
    this.pendingWorkflows.clear();
    this.processedRideIds.clear();
    this.callbacks = [];
    this.userId = null;
    this.university = null;
    this.initialized = false;

    console.log('[PostRideManager] Cleanup complete');
  }

  /**
   * Reset state (for testing)
   */
  reset() {
    this.pendingWorkflows.clear();
    this.processedRideIds.clear();
    this.notifyCallbacks();
  }
}

// Export singleton instance
export const postRideManager = new PostRideManager();
