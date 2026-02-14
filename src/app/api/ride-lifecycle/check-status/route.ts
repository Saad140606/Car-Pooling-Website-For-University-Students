import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import { verifyAuthToken } from '@/lib/api-security';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { LIFECYCLE_CONFIG } from '@/config/lifecycle';

/**
 * API Route: Check and Update Ride Lifecycle Status
 * 
 * This endpoint allows clients to trigger lifecycle status checks
 * and updates based on current time vs departure time.
 * 
 * This serves as a fallback/supplement to the Cloud Functions scheduler.
 */

const COMPLETION_WINDOW_OPEN_MINUTES = LIFECYCLE_CONFIG.COMPLETION_DELAY_MINUTES;
const COMPLETION_WINDOW_HOURS = LIFECYCLE_CONFIG.COMPLETION_WINDOW_DURATION_HOURS;

interface RideData {
  id: string;
  departureTime: any;
  lifecycleStatus?: string;
  status?: string;
  confirmedPassengers?: any[];
  driverId?: string;
  from?: string;
  to?: string;
  transitionLog?: any[];
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

function getLifecycleStatus(data: RideData): string {
  if (data.lifecycleStatus) return data.lifecycleStatus;
  
  // Map from legacy status
  switch (data.status) {
    case 'active': return 'OPEN';
    case 'full': return 'CONFIRMED';
    case 'completed': return 'COMPLETED';
    case 'cancelled': return 'CANCELLED';
    case 'expired': return 'FAILED';
    default: return 'OPEN';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuthToken(request);
    if (!authResult.success || !authResult.user?.uid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { university, rideId } = body;

    if (!university || !rideId) {
      return NextResponse.json(
        { success: false, error: 'Missing university or rideId' },
        { status: 400 }
      );
    }

    // Fetch the ride
    const rideRef = adminDb.doc(`universities/${university}/rides/${rideId}`);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Ride not found' },
        { status: 404 }
      );
    }

    const rideData = rideSnap.data() as RideData;
    const currentStatus = getLifecycleStatus(rideData);
    const now = Timestamp.now();
    const nowMs = now.toMillis();
    const departureMs = toMs(rideData.departureTime);

    if (isNaN(departureMs) || departureMs === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid departure time' },
        { status: 400 }
      );
    }

    let updated = false;
    let newStatus = currentStatus;
    let updateData: any = {};

    // Check if ride should transition to IN_PROGRESS
    if (
      nowMs >= departureMs &&
      (currentStatus === 'OPEN' || 
       currentStatus === 'REQUESTED' || 
       currentStatus === 'ACCEPTED' || 
       currentStatus === 'CONFIRMED')
    ) {
      const confirmedCount = (rideData.confirmedPassengers || []).length;
      const postLockStatus = confirmedCount > 0 ? 'IN_PROGRESS' : 'FAILED';
      
      const transitionLog = Array.isArray(rideData.transitionLog) 
        ? [...rideData.transitionLog] 
        : [];
      
      transitionLog.push({
        from: currentStatus,
        to: 'LOCKED',
        timestamp: now,
        triggeredBy: 'api_check',
        reason: 'Departure time reached (client trigger)',
      });
      
      transitionLog.push({
        from: 'LOCKED',
        to: postLockStatus,
        timestamp: now,
        triggeredBy: 'api_check',
        reason: postLockStatus === 'IN_PROGRESS'
          ? `${confirmedCount} confirmed passengers`
          : 'No confirmed passengers',
      });

      if (transitionLog.length > 50) {
        transitionLog.splice(0, transitionLog.length - 50);
      }

      updateData = {
        lifecycleStatus: postLockStatus,
        status: postLockStatus === 'IN_PROGRESS' ? 'active' : 'expired',
        transitionLog,
        updatedAt: now,
      };

      if (postLockStatus === 'IN_PROGRESS') {
        const windowEnd = departureMs + COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;
        updateData.completionWindowEnd = Timestamp.fromMillis(windowEnd);
      }

      updated = true;
      newStatus = postLockStatus;

      console.log(`[LifecycleCheck] Ride ${rideId} transitioned to ${postLockStatus}`);
    }
    // Check if ride should transition to COMPLETION_WINDOW
    else if (currentStatus === 'IN_PROGRESS') {
      const minutesAfterDeparture = (nowMs - departureMs) / (60 * 1000);
      
      if (minutesAfterDeparture >= COMPLETION_WINDOW_OPEN_MINUTES) {
        const transitionLog = Array.isArray(rideData.transitionLog) 
          ? [...rideData.transitionLog] 
          : [];
        
        transitionLog.push({
          from: 'IN_PROGRESS',
          to: 'COMPLETION_WINDOW',
          timestamp: now,
          triggeredBy: 'api_check',
          reason: `Completion window opened (${minutesAfterDeparture.toFixed(1)} minutes after departure)`,
        });

        if (transitionLog.length > 50) {
          transitionLog.splice(0, transitionLog.length - 50);
        }

        updateData = {
          lifecycleStatus: 'COMPLETION_WINDOW',
          transitionLog,
          updatedAt: now,
        };

        updated = true;
        newStatus = 'COMPLETION_WINDOW';

        console.log(`[LifecycleCheck] Ride ${rideId} transitioned to COMPLETION_WINDOW`);

        // Send notifications to all participants
        try {
          const driverId = rideData.driverId;
          const confirmedPassengers = rideData.confirmedPassengers || [];
          const rideFrom = rideData.from || 'Start';
          const rideTo = rideData.to || 'Destination';

          // Notify driver
          if (driverId) {
            await adminDb.collection(`universities/${university}/notifications`).add({
              userId: driverId,
              type: 'ride_completion',
              title: '✅ Complete Your Ride',
              message: `Please confirm completion for your ride from ${rideFrom} → ${rideTo}`,
              relatedRideId: rideId,
              isRead: false,
              priority: 'high',
              createdAt: now,
            });
          }

          // Notify passengers
          for (const passenger of confirmedPassengers) {
            const passengerId = typeof passenger === 'string' ? passenger : passenger.userId;
            if (passengerId) {
              await adminDb.collection(`universities/${university}/notifications`).add({
                userId: passengerId,
                type: 'ride_completion',
                title: '✅ Complete Your Ride',
                message: `Please confirm completion for your ride from ${rideFrom} → ${rideTo}`,
                relatedRideId: rideId,
                isRead: false,
                priority: 'high',
                createdAt: now,
              });
            }
          }
        } catch (notifyError) {
          console.error('[LifecycleCheck] Error sending notifications:', notifyError);
        }
      }
    }

    // Apply updates if any
    if (updated && Object.keys(updateData).length > 0) {
      await rideRef.update(updateData);
    }

    return NextResponse.json({
      success: true,
      updated,
      previousStatus: currentStatus,
      newStatus,
      minutesAfterDeparture: (nowMs - departureMs) / (60 * 1000),
      completionDelayMinutes: COMPLETION_WINDOW_OPEN_MINUTES,
    });
  } catch (error: any) {
    console.error('[LifecycleCheck] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
