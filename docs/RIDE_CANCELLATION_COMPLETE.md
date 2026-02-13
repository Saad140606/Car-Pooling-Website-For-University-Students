# Ride Cancellation System - Complete Implementation Guide

## Overview

A comprehensive ride cancellation ecosystem has been implemented with the following components:

- **Driver Cancellation**: Cancel entire rides (notifies all passengers)
- **Passenger Cancellation**: Cancel individual bookings/requests
- **Abuse Prevention**: Auto-lock accounts with >35% cancellation rate (after 3+ rides)
- **Confirmation Dialog**: Visual warnings about cancellation rates and consequences
- **Real-time Sync**: Firestore transactions ensure atomicity
- **Notifications**: All affected users notified of cancellations

## Architecture

### Core Service Layer
📁 `src/lib/rideCancellationService.ts` (425 lines)

Functions:
- `validateCancellationPermission()` - Checks departure time (cannot cancel after ride starts)
- `isAccountLocked()` - Checks if user account is suspended
- `isLateCancellation()` - Determines if booking was CONFIRMED
- `isDuplicateCancellation()` - Prevents double-cancel idempotency
- `calculateCancellationRate()` - Computes: cancellations ÷ participations × 100%
- `shouldLockAccount()` - Threshold logic: >35% rate + 3+ rides = lock
- `generateCancellationNotification()` - Returns user-friendly messages
- `buildCancellationTrackingUpdate()` - Constructs user profile updates

### Confirmation Dialog Component
📁 `src/components/CancellationConfirmDialog.tsx` (196 lines)

Features:
- Dynamic color-coding: Green (0-30%), Orange (30-50%), Red (>50%)
- Cancellation rate percentage badge
- Last-minute warning (if <30 min to departure)
- Account lock timer display
- Two action buttons: "Keep Booking" + "Yes, Cancel"
- Role distinction: Driver cancelling ride vs. Passenger cancelling booking

Props:
```typescript
interface CancellationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  cancellerRole: 'driver' | 'passenger';
  cancellationRate?: number;
  minutesUntilDeparture?: number;
  showRateWarning?: boolean;
  showAccountLockWarning?: boolean;
  accountLockMinutesRemaining?: number;
}
```

### API Endpoints

#### Driver Ride Cancellation
📁 `src/app/api/rides/cancel/route.ts` (203 lines)

**Request:**
```json
POST /api/rides/cancel
{
  "university": "FAST",
  "rideId": "ride_123",
  "reason": "Driver cancelled ride"
}
```

**Logic:**
1. Auth + rate limiting (20 req/min)
2. Validate university and ride ID
3. Check departure time (cannot cancel after)
4. Check account lock status (return 403 if locked)
5. Atomic transaction:
   - Update ride: status='cancelled' + metadata
   - Cancel ALL bookings (ACCEPTED + CONFIRMED)
   - Cancel ALL requests
   - Update driver metrics (totalCancellations++)
   - Auto-lock driver if >35% rate with 3+ participations
6. Notify all affected passengers

**Response:**
```json
{
  "ok": true,
  "data": {
    "rideId": "ride_123",
    "passengersAffected": 3,
    "status": "cancelled"
  }
}
```

#### Passenger Request Cancellation
📁 `src/app/api/requests/cancel/route.ts` (330+ lines - ENHANCED)

**Request:**
```json
POST /api/requests/cancel
{
  "university": "FAST",
  "rideId": "ride_123",
  "requestId": "booking_456",
  "reason": "Passenger cancelled booking"
}
```

**New Validation Layer:**
1. Pre-transaction checks:
   - Departure time validation
   - Account lock check (403 if locked)
   - Duplicate cancellation prevention (400 if already cancelled)
2. Authorization: User must be passenger or driver
3. Status validation: Only PENDING/ACCEPTED/CONFIRMED can cancel
4. Transaction:
   - Update request/booking: status='CANCELLED' + metadata
   - Release seats based on previous status (ACCEPTED/CONFIRMED)
   - Track cancellation metrics:
     - lateCancellations (if CONFIRMED)
     - totalCancellations (always)
     - totalParticipations
   - Auto-lock if >35% rate + 3+ participations (7-day suspension)
   - Apply 24-hour cooldown if 3+ late cancellations
5. Notify affected party (driver or passengers)

**Response:**
```json
{
  "ok": true,
  "data": {
    "cancellerRole": "passenger",
    "isLateCancellation": true,
    "passengerId": "user_123",
    "driverId": "driver_456"
  }
}
```

### UI Integration

#### Driver Dashboard (My-Rides)
📁 `src/app/dashboard/my-rides/page.tsx`

- **Cancel Ride Button**: Appears in card footer (outline variant, red text)
- **State**: `showCancelDialog`, `isCancelling`
- **Handler**: `handleCancelRide()` - Calls `/api/rides/cancel`
- **Dialog**: `CancellationConfirmDialog` with `cancellerRole="driver"`
- **Status**: Hides cancel button if ride.status='cancelled'

#### Passenger Dashboard (My-Bookings)
📁 `src/app/dashboard/my-bookings/page.tsx`

- **Cancel Booking Button**: Appears in 3 places:
  1. CONFIRMED status section
  2. Pending confirmation section
  3. Accepted/awaiting confirmation section
- **State**: `showCancelDialog`, `cancelling`
- **Handler**: `handleCancelRide()` - enhanced with error handling
  - 403 response handled as account lock
  - Dialog closes on success
  - Shows account lock timer
- **Dialog**: `CancellationConfirmDialog` with:
  - `cancellerRole="passenger"`
  - `cancellationRate={cancellationRate}` (calculated from bookings)
  - `showRateWarning={cancellationRate > 30}`

#### Find Rides Page (Browse Rides)
📁 `src/components/FullRideCard.tsx`

- **Cancel Request Button**: 3 locations:
  1. Non-urgent rides (Confirm Now + Confirm Later + Cancel)
  2. Urgent/already confirmed (Confirm Ride + Cancel)
  3. Pending request section (Cancel Request)
- **State**: `showCancelDialog`, `cancelling`
- **Handler**: `handleCancelRequest()` - enhanced with account lock detection
- **Dialog**: `CancellationConfirmDialog` with `cancellerRole="passenger"`

### Database Schema Updates

#### User Profile Fields (types.ts)
```typescript
interface UserProfile {
  // Existing fields...
  
  // NEW: Cancellation Tracking
  totalParticipations?: number;        // Total rides offered/booked
  totalCancellations?: number;         // Lifetime cancellation count
  lateCancellations?: number;          // CONFIRMED-status cancellations
  lastCancellationAt?: Timestamp;      // When user last cancelled
  
  // NEW: Account Lock
  accountLockUntil?: Timestamp;        // Suspension end time (7 days)
  cooldownUntil?: Timestamp;           // Cancellation ban end (24 hours)
}
```

#### Ride Fields (types.ts)
```typescript
interface Ride {
  // Existing fields...
  
  // NEW: Cancellation Metadata
  cancelledAt?: Timestamp;             // When driver cancelled
  cancelledBy?: string;                // Driver UID who cancelled
  cancellationReason?: string;         // Human-readable reason
}
```

#### Booking Fields (types.ts)
```typescript
interface Booking {
  // Existing fields...
  status: 'pending' | 'accepted' | 'CONFIRMED' | 'rejected' | 'CANCELLED'; // Updated union
  
  // NEW: Cancellation Metadata
  cancelledAt?: Timestamp;             // When cancelled
  cancelledBy?: string;                // User UID who cancelled
  cancellationReason?: string;         // Human-readable reason
  isLateCancellation?: boolean;         // Was booking CONFIRMED?
}
```

### Firestore Security Rules

#### User Profile Rules (firestore.rules)
```
Updated to allow updates to cancellation tracking fields:
- totalParticipations
- totalCancellations
- lateCancellations
- lastCancellationAt
- accountLockUntil
- cooldownUntil
```

#### Ride Rules (firestore.rules)
```
Added: Driver can cancel ride (set status='cancelled' + metadata)
- Checks: user.uid == document.data.driverId
- Allowed fields: status, cancelledAt, cancelledBy, cancellationReason
```

#### Booking Rules (firestore.rules)
```
Updated: Allows cancellation field updates (status, metadata)
- Checks: user is passenger or driver
- Allowed fields: status, cancelledAt, cancelledBy, cancellationReason, isLateCancellation
```

## Business Rules

### Cancellation Permission
✓ Can cancel BEFORE departure time
✗ Cannot cancel AFTER ride has started
✗ Cannot cancel if account is locked
✓ Can cancel in PENDING/ACCEPTED/CONFIRMED status

### Late Cancellation Penalty
- **Definition**: Cancelling a booking in CONFIRMED status
- **Tracking**: `isLateCancellation` field set to `true`
- **Impact**: Counted toward cancellation rate threshold
- **Cooldown**: 3+ late cancellations = 24-hour ban on all cancellations

### Account Auto-Lock
- **Trigger**: Cancellation rate > 35% AND total participations ≥ 3
- **Duration**: 7 days (604,800 seconds)
- **Applied Before**: Transaction commits
- **Effect**: All cancellation endpoints return 403 Forbidden
- **Recovery**: Automatic unlock after 7 days

### Calculation
```
Cancellation Rate = (totalCancellations ÷ totalParticipations) × 100%

Example:
- 10 participations, 4 cancellations = 40% → ACCOUNT LOCKED (>35%)
- 10 participations, 3 cancellations = 30% → OK (<35%)
- 2 participations, 1 cancellation  = 50% → OK (< 3 minimum rides)
```

## Deployment Checklist

- [x] Service layer created (`rideCancellationService.ts`)
- [x] Types updated with cancellation fields
- [x] Firestore rules enhanced
- [x] Driver cancellation API implemented
- [x] Passenger cancellation API enhanced
- [x] Confirmation dialog component created
- [x] Driver dashboard integrated
- [x] Passenger dashboard integrated
- [x] Find-rides page integrated
- [ ] Testing in staging environment
- [ ] Monitor abuse patterns in production
- [ ] Fine-tune threshold if needed (35% at 3+ rides)

## Error Handling

### User-Friendly Messages

| Error | Status | Message |
|-------|--------|---------|
| Ride departed | 400 | "Cannot cancel after ride has departed" |
| Account locked | 403 | "Account locked. Try again in X minutes" |
| Already cancelled | 400 | "Request already cancelled" |
| Not authorized | 403 | "Only passenger or driver can cancel this request" |
| Invalid status | 400 | "Cannot cancel request with current status" |

### Network Error Handling
- Integrated with existing `networkErrorHandler` system
- Automatic retry on timeout
- User-friendly error banners
- Full error logging for debugging

## Monitoring & Analytics

Track these metrics in production:
1. Cancellation rate distribution (by university)
2. Auto-lock triggers per day
3. Average time-to-cancel from confirmation
4. Cancellation reason breakdown
5. False-positive lock rates

## Testing Scenarios

### Test 1: Driver Cancels Ride with Passengers
```
✓ Ride status → 'cancelled'
✓ All bookings updated to 'CANCELLED'
✓ All requests updated to 'CANCELLED'
✓ Seats not adjusted (ride no longer exists in active list)
✓ All passengers notified
✓ Driver metrics updated
```

### Test 2: Passenger Cancels CONFIRMED Booking (Late)
```
✓ Booking status → 'CANCELLED'
✓ isLateCancellation = true
✓ Cancellation metrics incremented
✓ If >35% rate (3+ rides): accountLockUntil set
✓ If 3+ late cancellations: cooldownUntil set
✓ Driver notified
✓ Seat released back to available pool
```

### Test 3: Account Lock Enforcement
```
✓ Locked user cannot cancel (403)
✓ Locked user cannot create new rides (403)
✓ After 7 days: automatic unlock
✓ User can cancel again immediately after unlock
```

### Test 4: Duplicate Cancellation Prevention
```
✓ First cancel: succeeds
✓ Second cancel: fails with "already cancelled"
✓ No double-notifications
✓ Metrics not incremented twice
```

### Test 5: Confirmation Dialog Warnings
```
✓ 0-30% rate: green, no warning
✓ 30-50% rate: orange, shows warning
✓ >50% rate: red, shows critical warning
✓ Account lock timer shows if locked
✓ Late-minute cancellation shows if <30 min
```

## Known Limitations

1. **Cancellation rate**: Not displayed in find-rides view (set to 0)
2. **Account lock**: Auto-unlock only works via server timestamp
3. **Historical tracking**: Cooldown timer persists across sessions
4. **Bulk operations**: Driver cancellation cancels ALL bookings (no selective)

## Future Enhancements

1. **Soft Bans**: Temporary suspension instead of hard lock
2. **Appeals Process**: Users can request unlock review
3. **Cancellation Reason Categories**: Track common reasons
4. **Dynamic Thresholds**: Adjust 35% based on platform metrics
5. **Leaderboard**: Show "reliable" drivers/passengers
6. **Recovery Programs**: Reduce lock time with good behavior

## Related Documentation

- Network Error Handling: `docs/NETWORK_ERROR_HANDLING_DEPLOYMENT.md`
- Firestore Rules: `firestore.rules`
- API Security: `src/lib/api-security.ts`
- Notification System: `src/lib/rideNotificationService.ts`

---

**Status**: ✅ Complete and Ready for Testing
**Last Updated**: $(date)
**Implemented By**: GitHub Copilot
