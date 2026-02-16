'use client';

/**
 * Ride Completion Manager
 * 
 * Production-grade service that:
 * - Monitors rides for completion eligibility (departure_time + 5 min)
 * - Persists workflow state to Firestore + localStorage
 * - Handles provider and passenger flows
 * - Syncs analytics on completion
 * - Recovers from network failures
 * - Prevents duplicate processing
 */

import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type {
  PendingCompletionWorkflow,
  RideCompletionDoc,
  RideSummary,
  ConfirmedPassengerInfo,
  ProviderFormData,
  PassengerFormData,
  CompletionLocalCache,
  CompletionAnalyticsPayload,
} from '@/types/rideCompletion';
import { shouldTriggerWorkflow, toSafeDate } from '@/types/rideCompletion';

const LOCAL_CACHE_KEY = 'campus_rides_completion_cache';
const WORKFLOW_FORM_PREFIX = 'campus_rides_wf_';

type WorkflowCallback = (workflows: PendingCompletionWorkflow[]) => void;

class RideCompletionManager {
  private firestore: Firestore | null = null;
  private userId: string | null = null;
  private university: string | null = null;

  // Listeners
  private providerListener: (() => void) | null = null;
  private passengerListener: (() => void) | null = null;
  private completionDocListeners: Map<string, () => void> = new Map();
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();

  // State
  private pendingWorkflows: Map<string, PendingCompletionWorkflow> = new Map();
  private processedKeys: Set<string> = new Set();
  private callbacks: WorkflowCallback[] = [];
  private initialized = false;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  initialize(firestore: Firestore, userId: string, university: string) {
    if (this.initialized && this.userId === userId && this.university === university) {
      return;
    }

    // Cleanup previous if switching users
    if (this.initialized) {
      this.cleanup();
    }

    this.firestore = firestore;
    this.userId = userId;
    this.university = university;
    this.initialized = true;

    console.log('[CompletionManager] Initializing', { userId, university });

    // 1. Restore from local cache first (instant UI)
    this.restoreFromLocalCache();

    // 2. Check Firestore for pending workflows
    this.checkExistingCompletionDocs();

    // 3. Setup real-time listeners for rides
    this.setupRideListeners();
  }

  // ============================================================================
  // LOCAL CACHE (persistence across reloads)
  // ============================================================================

  private getLocalCache(): CompletionLocalCache {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return { pendingWorkflows: [], formDrafts: {}, lastChecked: 0 };
      return JSON.parse(raw);
    } catch {
      return { pendingWorkflows: [], formDrafts: {}, lastChecked: 0 };
    }
  }

  private saveLocalCache(cache: CompletionLocalCache) {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('[CompletionManager] Failed to save local cache:', e);
    }
  }

  private restoreFromLocalCache() {
    const cache = this.getLocalCache();
    if (!cache.pendingWorkflows.length) return;

    for (const entry of cache.pendingWorkflows) {
      if (entry.userId !== this.userId || entry.university !== this.university) continue;
      const key = `${entry.rideId}-${entry.userRole}`;
      if (this.processedKeys.has(key)) continue;

      // Mark as needing Firestore verification (we'll populate fully from Firestore)
      console.log('[CompletionManager] Restored cached workflow:', key);
    }
  }

  private addToLocalCache(workflow: PendingCompletionWorkflow) {
    const cache = this.getLocalCache();
    const exists = cache.pendingWorkflows.some(
      w => w.rideId === workflow.rideId && w.userRole === workflow.userRole && w.userId === workflow.userId
    );
    if (!exists) {
      cache.pendingWorkflows.push({
        rideId: workflow.rideId,
        userId: workflow.userId,
        userRole: workflow.userRole,
        university: workflow.university,
        detectedAt: workflow.detectedAt,
      });
      cache.lastChecked = Date.now();
      this.saveLocalCache(cache);
    }
  }

  private removeFromLocalCache(rideId: string, role: 'provider' | 'passenger') {
    const cache = this.getLocalCache();
    cache.pendingWorkflows = cache.pendingWorkflows.filter(
      w => !(w.rideId === rideId && w.userRole === role && w.userId === this.userId)
    );
    // Remove form draft
    delete cache.formDrafts[`${rideId}-${role}`];
    this.saveLocalCache(cache);
  }

  saveFormDraft(rideId: string, role: 'provider' | 'passenger', formData: ProviderFormData | PassengerFormData) {
    try {
      const key = `${WORKFLOW_FORM_PREFIX}${rideId}_${role}`;
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (e) {
      console.warn('[CompletionManager] Failed to save form draft:', e);
    }
  }

  loadFormDraft(rideId: string, role: 'provider' | 'passenger'): ProviderFormData | PassengerFormData | null {
    try {
      const key = `${WORKFLOW_FORM_PREFIX}${rideId}_${role}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearFormDraft(rideId: string, role: 'provider' | 'passenger') {
    try {
      const key = `${WORKFLOW_FORM_PREFIX}${rideId}_${role}`;
      localStorage.removeItem(key);
    } catch {}
  }

  // ============================================================================
  // CHECK EXISTING COMPLETION DOCS
  // ============================================================================

  private async checkExistingCompletionDocs() {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      const completionsRef = collection(this.firestore, 'universities', this.university, 'rideCompletions');

      // Check provider workflows
      const providerQ = query(completionsRef, where('providerWorkflowPending', '==', true));
      const providerSnap = await getDocs(providerQ);

      for (const docSnap of providerSnap.docs) {
        const data = docSnap.data() as RideCompletionDoc;
        // Verify this user is the provider
        await this.checkAndAddProviderWorkflow(data.rideId);
      }

      // Check passenger workflows
      const passengerQ = query(completionsRef);
      const passengerSnap = await getDocs(passengerQ);

      for (const docSnap of passengerSnap.docs) {
        const data = docSnap.data() as RideCompletionDoc;
        if (data.passengerWorkflows?.[this.userId]?.pending && !data.passengerWorkflows[this.userId]?.completed) {
          await this.buildWorkflowFromRide(data.rideId, 'passenger');
        }
      }
    } catch (error) {
      console.error('[CompletionManager] Error checking existing docs:', error);
    }
  }

  private async checkAndAddProviderWorkflow(rideId: string) {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) return;

      const rideData = rideSnap.data();
      const driverId = rideData.driverId || rideData.createdBy;
      if (driverId !== this.userId) return;

      await this.buildWorkflowFromRide(rideId, 'provider');
    } catch (error) {
      console.error('[CompletionManager] Error checking provider workflow:', error);
    }
  }

  // ============================================================================
  // RIDE LISTENERS
  // ============================================================================

  private setupRideListeners() {
    if (!this.firestore || !this.userId || !this.university) return;

    const ridesRef = collection(this.firestore, 'universities', this.university, 'rides');

    // Provider rides (where user is driver)
    const driverQ = query(ridesRef, where('driverId', '==', this.userId));
    this.providerListener = onSnapshot(driverQ, (snapshot) => {
      for (const rideDoc of snapshot.docs) {
        this.evaluateRide(rideDoc.id, rideDoc.data(), 'provider');
      }
    }, (error) => {
      console.error('[CompletionManager] Provider listener error:', error);
    });

    // Passenger rides (bookings approach - check rides where user has bookings)
    const bookingsRef = collection(this.firestore, 'universities', this.university, 'bookings');
    const passengerBookingsQ = query(
      bookingsRef,
      where('passengerId', '==', this.userId),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    );

    this.passengerListener = onSnapshot(passengerBookingsQ, async (snapshot) => {
      for (const bookingDoc of snapshot.docs) {
        const booking = bookingDoc.data();
        if (!booking.rideId) continue;

        try {
          const rideRef = doc(this.firestore!, 'universities', this.university!, 'rides', booking.rideId);
          const rideSnap = await getDoc(rideRef);
          if (rideSnap.exists()) {
            this.evaluateRide(booking.rideId, rideSnap.data(), 'passenger');
          }
        } catch {}
      }
    }, (error) => {
      console.error('[CompletionManager] Passenger listener error:', error);
    });
  }

  // ============================================================================
  // EVALUATE RIDE FOR WORKFLOW TRIGGER
  // ============================================================================

  private evaluateRide(rideId: string, rideData: any, role: 'provider' | 'passenger') {
    const key = `${rideId}-${role}`;
    if (this.processedKeys.has(key)) return;

    const departureTime = toSafeDate(rideData.departureTime);
    if (!departureTime) return;

    // Ride must be past departure + 5 minutes
    if (shouldTriggerWorkflow(departureTime)) {
      // Check if already cancelled
      if (rideData.status === 'cancelled' || rideData.lifecycleStatus === 'CANCELLED') return;

      this.buildWorkflowFromRide(rideId, role).catch(err => {
        console.error('[CompletionManager] Failed to build workflow:', err);
      });
    } else {
      // Schedule a timer for when it becomes eligible
      const triggerAt = departureTime.getTime() + 5 * 60 * 1000;
      const delay = triggerAt - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Only schedule within 24h
        if (!this.scheduledTimers.has(key)) {
          const timer = setTimeout(() => {
            this.scheduledTimers.delete(key);
            this.buildWorkflowFromRide(rideId, role).catch(() => {});
          }, delay + 1000); // +1s buffer
          this.scheduledTimers.set(key, timer);
        }
      }
    }
  }

  // ============================================================================
  // BUILD WORKFLOW FROM RIDE DATA
  // ============================================================================

  private async buildWorkflowFromRide(rideId: string, role: 'provider' | 'passenger'): Promise<void> {
    if (!this.firestore || !this.userId || !this.university) return;

    const key = `${rideId}-${role}`;
    if (this.processedKeys.has(key)) return;

    try {
      // Check completion doc first
      const completionRef = doc(this.firestore, 'universities', this.university, 'rideCompletions', rideId);
      const completionSnap = await getDoc(completionRef);

      if (completionSnap.exists()) {
        const completionData = completionSnap.data() as RideCompletionDoc;

        // Check if already completed for this role
        if (role === 'provider' && completionData.providerWorkflowCompleted) {
          this.processedKeys.add(key);
          return;
        }
        if (role === 'passenger' && completionData.passengerWorkflows?.[this.userId]?.completed) {
          this.processedKeys.add(key);
          return;
        }
      }

      // Fetch ride data
      const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) return;

      const rideData = rideSnap.data();
      const departureTime = toSafeDate(rideData.departureTime);
      if (!departureTime) return;

      // Verify trigger condition
      if (!shouldTriggerWorkflow(departureTime)) return;

      // Verify role
      const driverId = rideData.driverId || rideData.createdBy;
      if (role === 'provider' && driverId !== this.userId) return;

      // Get confirmed bookings
      const bookingsRef = collection(this.firestore, 'universities', this.university, 'bookings');
      const bookingsQ = query(
        bookingsRef,
        where('rideId', '==', rideId),
        where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
      );
      const bookingsSnap = await getDocs(bookingsQ);

      const confirmedPassengers: ConfirmedPassengerInfo[] = [];
      for (const bDoc of bookingsSnap.docs) {
        const b = bDoc.data();
        // For passenger role, verify this booking belongs to the user
        if (role === 'passenger' && b.passengerId !== this.userId) continue;

        confirmedPassengers.push({
          id: b.passengerId,
          name: b.passengerDetails?.fullName || b.passengerName || 'Passenger',
          email: b.passengerDetails?.email || '',
          pickupLocation: b.pickupPlaceName || b.pickupLocation || '',
          bookingId: bDoc.id,
          price: b.price || rideData.price || 0,
        });
      }

      // For passenger role, the user must have a confirmed booking
      if (role === 'passenger' && confirmedPassengers.length === 0) return;

      // Build the ride summary
      const rideSummary: RideSummary = {
        rideId,
        providerName: rideData.driverInfo?.fullName || 'Ride Provider',
        from: rideData.from || rideData.departureLocation || '',
        to: rideData.to || rideData.destinationLocation || '',
        totalSeats: rideData.totalSeats || 0,
        totalBookings: bookingsSnap.size,
        departureTime,
        price: rideData.price || 0,
        transportMode: rideData.transportMode || 'car',
        hasConfirmedPassengers: bookingsSnap.size > 0,
        rideStatusLabel: bookingsSnap.size > 0 ? 'Ride Confirmed' : '',
      };

      // Provider flow: all confirmed passengers needed
      // Passenger flow: only this user's booking
      const passengersForWorkflow = role === 'provider'
        ? confirmedPassengers
        : confirmedPassengers.filter(p => p.id === this.userId);

      const workflow: PendingCompletionWorkflow = {
        rideId,
        oderId: key,
        userId: this.userId,
        userRole: role,
        university: this.university,
        rideSummary,
        confirmedPassengers: role === 'provider' ? confirmedPassengers : passengersForWorkflow,
        detectedAt: Date.now(),
        localCacheKey: key,
      };

      // Ensure completion doc exists in Firestore
      await this.ensureCompletionDoc(rideId, role, driverId);

      // Add to pending
      this.pendingWorkflows.set(key, workflow);
      this.processedKeys.add(key);
      this.addToLocalCache(workflow);
      this.notifyCallbacks();

      console.log('[CompletionManager] Workflow created:', key);
    } catch (error) {
      console.error('[CompletionManager] Error building workflow:', error);
    }
  }

  // ============================================================================
  // ENSURE COMPLETION DOC
  // ============================================================================

  private async ensureCompletionDoc(rideId: string, role: 'provider' | 'passenger', providerId: string) {
    if (!this.firestore || !this.userId || !this.university) return;

    const completionRef = doc(this.firestore, 'universities', this.university, 'rideCompletions', rideId);
    const snap = await getDoc(completionRef);

    if (!snap.exists()) {
      // Create new completion doc
      const docData: Partial<RideCompletionDoc> = {
        rideId,
        university: this.university,
        createdAt: serverTimestamp(),
        providerWorkflowPending: role === 'provider',
        providerWorkflowCompleted: false,
        passengerWorkflows: {},
        analyticsProcessed: false,
      };

      if (role === 'passenger') {
        docData.passengerWorkflows = {
          [this.userId]: { pending: true, completed: false },
        };
      }

      await setDoc(completionRef, docData);
    } else {
      // Update existing doc
      const updates: any = {};
      if (role === 'provider') {
        updates.providerWorkflowPending = true;
      } else {
        updates[`passengerWorkflows.${this.userId}.pending`] = true;
        updates[`passengerWorkflows.${this.userId}.completed`] = false;
      }
      await updateDoc(completionRef, updates);
    }
  }

  // ============================================================================
  // SUBMIT PROVIDER WORKFLOW
  // ============================================================================

  async submitProviderWorkflow(rideId: string, formData: ProviderFormData): Promise<void> {
    if (!this.firestore || !this.userId || !this.university) {
      throw new Error('Manager not initialized');
    }

    const completionRef = doc(this.firestore, 'universities', this.university, 'rideCompletions', rideId);
    const batch = writeBatch(this.firestore);

    // Build attendance map
    const passengerAttendance: Record<string, any> = {};
    for (const [passengerId, record] of Object.entries(formData.attendanceRecords)) {
      passengerAttendance[passengerId] = {
        status: record.arrivalStatus,
        rating: record.arrivalStatus === 'arrived' ? (formData.passengerRatings[passengerId] || 0) : undefined,
        review: record.arrivalStatus === 'arrived' ? (formData.passengerReviews[passengerId] || '') : undefined,
        notArrivedReason: record.arrivalStatus === 'did_not_arrive' ? (formData.notArrivedReasons[passengerId] || 'no_show') : undefined,
        notArrivedReasonCustom: record.arrivalStatus === 'did_not_arrive' ? (formData.notArrivedReasonsCustom[passengerId] || '') : undefined,
      };
    }

    // Update completion doc
    batch.update(completionRef, {
      providerWorkflowPending: false,
      providerWorkflowCompleted: true,
      providerCompletedAt: serverTimestamp(),
      providerDecision: formData.rideCompleted ? 'completed' : 'not_completed',
      providerNotCompletedReason: formData.rideCompleted ? null : formData.notCompletedReason,
      providerNotCompletedReasonCustom: formData.rideCompleted ? null : formData.notCompletedReasonCustom,
      passengerAttendance: formData.rideCompleted ? passengerAttendance : {},
    });

    // Update ride document
    const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
    batch.update(rideRef, {
      'postRideStatus.driverConfirmed': true,
      'postRideStatus.pendingDriver': false,
      'postRideStatus.completedAt': serverTimestamp(),
    });

    // Update booking documents with arrival status
    if (formData.rideCompleted) {
      const workflow = this.pendingWorkflows.get(`${rideId}-provider`);
      if (workflow) {
        for (const passenger of workflow.confirmedPassengers) {
          const attendance = formData.attendanceRecords[passenger.id];
          if (attendance) {
            const bookingRef = doc(this.firestore, 'universities', this.university, 'bookings', passenger.bookingId);
            batch.update(bookingRef, {
              driverReview: attendance.arrivalStatus === 'arrived' ? 'arrived' : 'no-show',
              driverReviewAt: serverTimestamp(),
            });
          }
        }
      }
    }

    await batch.commit();

    // Sync analytics
    await this.syncAnalyticsForRide(rideId, formData);

    // Remove from pending
    this.pendingWorkflows.delete(`${rideId}-provider`);
    this.removeFromLocalCache(rideId, 'provider');
    this.clearFormDraft(rideId, 'provider');
    this.notifyCallbacks();

    console.log('[CompletionManager] Provider workflow submitted:', rideId);
  }

  // ============================================================================
  // SUBMIT PASSENGER WORKFLOW
  // ============================================================================

  async submitPassengerWorkflow(rideId: string, formData: PassengerFormData): Promise<void> {
    if (!this.firestore || !this.userId || !this.university) {
      throw new Error('Manager not initialized');
    }

    const completionRef = doc(this.firestore, 'universities', this.university, 'rideCompletions', rideId);
    const batch = writeBatch(this.firestore);

    // Update completion doc
    batch.update(completionRef, {
      [`passengerWorkflows.${this.userId}.pending`]: false,
      [`passengerWorkflows.${this.userId}.completed`]: true,
      [`passengerWorkflows.${this.userId}.completedAt`]: serverTimestamp(),
      [`passengerWorkflows.${this.userId}.decision`]: formData.rideCompleted ? 'completed' : 'not_completed',
      [`passengerWorkflows.${this.userId}.notCompletedReason`]: formData.rideCompleted ? null : formData.notCompletedReason,
      [`passengerWorkflows.${this.userId}.notCompletedReasonCustom`]: formData.rideCompleted ? null : formData.notCompletedReasonCustom,
      [`passengerWorkflows.${this.userId}.providerRating`]: formData.rideCompleted ? (formData.providerRating || null) : null,
      [`passengerWorkflows.${this.userId}.providerReview`]: formData.rideCompleted ? (formData.providerReview || '') : null,
    });

    // Update ride document
    const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
    batch.update(rideRef, {
      'postRideStatus.passengerConfirmed': true,
      'postRideStatus.pendingPassenger': false,
    });

    // Update booking with passenger's completion status
    const workflow = this.pendingWorkflows.get(`${rideId}-passenger`);
    if (workflow && workflow.confirmedPassengers.length > 0) {
      const booking = workflow.confirmedPassengers[0];
      const bookingRef = doc(this.firestore, 'universities', this.university, 'bookings', booking.bookingId);
      batch.update(bookingRef, {
        passengerCompletion: formData.rideCompleted ? 'completed' : 'cancelled',
        passengerCompletionAt: serverTimestamp(),
        completionReason: formData.rideCompleted ? null : formData.notCompletedReason,
      });
    }

    await batch.commit();

    // Sync analytics for passenger
    await this.syncPassengerAnalytics(rideId, formData);

    // Remove from pending
    this.pendingWorkflows.delete(`${rideId}-passenger`);
    this.removeFromLocalCache(rideId, 'passenger');
    this.clearFormDraft(rideId, 'passenger');
    this.notifyCallbacks();

    console.log('[CompletionManager] Passenger workflow submitted:', rideId);
  }

  // ============================================================================
  // ANALYTICS SYNC
  // ============================================================================

  private async syncAnalyticsForRide(rideId: string, formData: ProviderFormData) {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      const workflow = this.pendingWorkflows.get(`${rideId}-provider`);
      if (!workflow) return;

      const batch = writeBatch(this.firestore);
      const now = serverTimestamp();

      if (formData.rideCompleted) {
        // Calculate earnings from arrived passengers only
        let totalEarnings = 0;
        const arrivedPassengers: string[] = [];

        for (const passenger of workflow.confirmedPassengers) {
          const attendance = formData.attendanceRecords[passenger.id];
          if (attendance?.arrivalStatus === 'arrived') {
            totalEarnings += passenger.price;
            arrivedPassengers.push(passenger.id);

            // Track passenger spending
            const spendingRef = doc(this.firestore, 'universities', this.university, 'passengerSpending', passenger.bookingId);
            batch.set(spendingRef, {
              bookingId: passenger.bookingId,
              rideId,
              passengerId: passenger.id,
              driverId: this.userId,
              amount: passenger.price,
              calculatedAt: now,
              from: workflow.rideSummary.from,
              to: workflow.rideSummary.to,
            });

            // Update passenger stats
            const passengerStatsRef = doc(this.firestore, 'universities', this.university, 'passengerStats', passenger.id);
            try {
              const psSnap = await getDoc(passengerStatsRef);
              if (psSnap.exists()) {
                const ps = psSnap.data();
                batch.update(passengerStatsRef, {
                  totalSpent: (ps.totalSpent || 0) + passenger.price,
                  totalRidesTaken: (ps.totalRidesTaken || 0) + 1,
                  lastRideAt: now,
                });
              } else {
                batch.set(passengerStatsRef, {
                  passengerId: passenger.id,
                  totalSpent: passenger.price,
                  totalRidesTaken: 1,
                  lastRideAt: now,
                  createdAt: now,
                });
              }
            } catch {}

            // Store provider's rating of this passenger
            const providerRating = formData.passengerRatings[passenger.id];
            if (providerRating) {
              const ratingRef = doc(this.firestore, 'universities', this.university, 'passengerRatings', `${rideId}_${passenger.id}`);
              batch.set(ratingRef, {
                rideId,
                passengerId: passenger.id,
                ratedBy: this.userId,
                ratedByRole: 'provider',
                rating: providerRating,
                review: formData.passengerReviews[passenger.id] || '',
                createdAt: now,
              });
            }
          }
          // Not arrived passengers: spending = 0 (nothing tracked)
        }

        // Store ride earnings
        const earningsRef = doc(this.firestore, 'universities', this.university, 'earnings', rideId);
        batch.set(earningsRef, {
          rideId,
          driverId: this.userId,
          university: this.university,
          totalEarnings,
          arrivedPassengers: arrivedPassengers.length,
          totalBookings: workflow.confirmedPassengers.length,
          pricePerSeat: workflow.rideSummary.price,
          passengersServed: arrivedPassengers,
          calculatedAt: now,
          from: workflow.rideSummary.from,
          to: workflow.rideSummary.to,
        });

        // Update driver stats
        const driverStatsRef = doc(this.firestore, 'universities', this.university, 'driverStats', this.userId);
        try {
          const dsSnap = await getDoc(driverStatsRef);
          if (dsSnap.exists()) {
            const ds = dsSnap.data();
            batch.update(driverStatsRef, {
              totalEarnings: (ds.totalEarnings || 0) + totalEarnings,
              totalRidesCompleted: (ds.totalRidesCompleted || 0) + 1,
              totalPassengersServed: (ds.totalPassengersServed || 0) + arrivedPassengers.length,
              lastEarningsAt: now,
            });
          } else {
            batch.set(driverStatsRef, {
              driverId: this.userId,
              totalEarnings,
              totalRidesCompleted: 1,
              totalPassengersServed: arrivedPassengers.length,
              totalRating: 0,
              ratingsCount: 0,
              averageRating: 0,
              lastEarningsAt: now,
              createdAt: now,
            });
          }
        } catch {}

        // Update ride status
        const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
        batch.update(rideRef, {
          status: 'completed',
          earningsCalculated: true,
          earningsCalculatedAt: now,
        });
      }

      // Mark analytics as processed
      const completionRef = doc(this.firestore, 'universities', this.university, 'rideCompletions', rideId);
      batch.update(completionRef, {
        analyticsProcessed: true,
        analyticsProcessedAt: now,
      });

      await batch.commit();
      console.log('[CompletionManager] Analytics synced for ride:', rideId);
    } catch (error) {
      console.error('[CompletionManager] Analytics sync error:', error);
      // Non-fatal: workflow is still marked complete
    }
  }

  private async syncPassengerAnalytics(rideId: string, formData: PassengerFormData) {
    if (!this.firestore || !this.userId || !this.university) return;

    try {
      if (formData.rideCompleted && formData.providerRating) {
        const batch = writeBatch(this.firestore);
        const now = serverTimestamp();

        // Get ride data for driver ID
        const rideRef = doc(this.firestore, 'universities', this.university, 'rides', rideId);
        const rideSnap = await getDoc(rideRef);
        if (!rideSnap.exists()) return;

        const rideData = rideSnap.data();
        const driverId = rideData.driverId || rideData.createdBy;

        // Store passenger's rating of provider
        const workflow = this.pendingWorkflows.get(`${rideId}-passenger`);
        const bookingId = workflow?.confirmedPassengers[0]?.bookingId || `${rideId}_${this.userId}`;

        const ratingRef = doc(this.firestore, 'universities', this.university, 'ratings', bookingId);
        batch.set(ratingRef, {
          id: bookingId,
          rideId,
          driverId,
          passengerId: this.userId,
          rating: formData.providerRating,
          review: formData.providerReview || '',
          createdAt: now,
          ratedByRole: 'passenger',
        });

        // Update driver's rating stats
        const driverStatsRef = doc(this.firestore, 'universities', this.university, 'driverStats', driverId);
        try {
          const dsSnap = await getDoc(driverStatsRef);
          if (dsSnap.exists()) {
            const ds = dsSnap.data();
            const newTotal = (ds.totalRating || 0) + formData.providerRating;
            const newCount = (ds.ratingsCount || 0) + 1;
            batch.update(driverStatsRef, {
              totalRating: newTotal,
              ratingsCount: newCount,
              averageRating: newTotal / newCount,
              lastRatingAt: now,
            });
          } else {
            batch.set(driverStatsRef, {
              driverId,
              totalRating: formData.providerRating,
              ratingsCount: 1,
              averageRating: formData.providerRating,
              lastRatingAt: now,
              createdAt: now,
              totalEarnings: 0,
              totalRidesCompleted: 0,
              totalPassengersServed: 0,
            });
          }
        } catch {}

        // Update booking
        const bookingRef = doc(this.firestore, 'universities', this.university, 'bookings', bookingId);
        try {
          batch.update(bookingRef, {
            driverRating: formData.providerRating,
            ratedAt: now,
          });
        } catch {}

        await batch.commit();
        console.log('[CompletionManager] Passenger analytics synced:', rideId);
      }
    } catch (error) {
      console.error('[CompletionManager] Passenger analytics sync error:', error);
    }
  }

  // ============================================================================
  // SUBSCRIPTION
  // ============================================================================

  subscribe(callback: WorkflowCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== callback);
    };
  }

  private notifyCallbacks() {
    const workflows = this.getPendingWorkflows();
    for (const cb of this.callbacks) {
      try { cb(workflows); } catch {}
    }
  }

  getPendingWorkflows(): PendingCompletionWorkflow[] {
    return Array.from(this.pendingWorkflows.values());
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup() {
    this.providerListener?.();
    this.passengerListener?.();
    this.completionDocListeners.forEach(unsub => unsub());
    this.scheduledTimers.forEach(timer => clearTimeout(timer));

    this.providerListener = null;
    this.passengerListener = null;
    this.completionDocListeners.clear();
    this.scheduledTimers.clear();
    this.pendingWorkflows.clear();
    this.processedKeys.clear();
    this.callbacks = [];
    this.userId = null;
    this.university = null;
    this.initialized = false;

    console.log('[CompletionManager] Cleanup complete');
  }
}

export const rideCompletionManager = new RideCompletionManager();
