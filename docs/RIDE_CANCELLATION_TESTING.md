# Ride Cancellation System - Testing Guide

## Pre-Testing Checklist

- [ ] Deploy code to staging environment
- [ ] Run Firestore emulator locally for initial testing
- [ ] Ensure test data includes:
  - Multiple rides in different states (active, full, expired)
  - Bookings in all states (pending, accepted, CONFIRMED, cancelled)
  - Users with varying cancellation rates (0%, 20%, 40%, 50%, 100%)
- [ ] Configure test accounts with known UIDs
- [ ] Set up monitoring dashboard for:
  - API response times
  - Error rates
  - Account lock triggers
  - Cancellation reason distribution

## Manual Testing Scenarios

### Scenario 1: Driver Cancels Ride with Multiple Passengers

**Setup:**
```
- Driver creates ride departing +2 hours
- 3 passengers book: 2 PENDING, 1 CONFIRMED
```

**Test:**
1. Open `/dashboard/my-rides`
2. Click "Cancel Ride" button on the ride card
3. Verify cancellation dialog shows:
   - ✓ Cancellation rate badge (green for driver not shown yet)
   - ✓ "Yes, Cancel" button enabled
   - ✓ "Keep Booking" button available
4. Click "Yes, Cancel"
5. Verify response:
   - ✓ Toast: "Ride Cancelled - 3 passengers notified"
   - ✓ Ride card disappears from list
   - ✓ Button disabled while loading

**Expected Database State:**
```firestore
ride/RIDE_ID:
  status: 'cancelled'
  cancelledAt: <timestamp>
  cancelledBy: <driver_uid>
  cancellationReason: 'Driver cancelled ride'

booking/BOOKING_1 (pending):
  status: 'CANCELLED'
  isLateCancellation: false

booking/BOOKING_2 (confirmed):
  status: 'CANCELLED'
  isLateCancellation: true

user/DRIVER_UID:
  totalCancellations: 1
  totalParticipations: 1
  lastCancellationAt: <timestamp>
  accountLockUntil: null (rate < 35%)
```

**Expected Notifications:**
```
- Passenger 1: "Driver cancelled your confirmed ride"
- Passenger 2: "Your ride request was cancelled"
- Passenger 3: "Your ride was cancelled"
```

### Scenario 2: Passenger Cancels CONFIRMED Booking (Late)

**Setup:**
```
- Passenger has 2 previous cancellations (0% rate, 3 participations)
- Booking status is CONFIRMED
- Ride departs in 45 minutes
```

**Test:**
1. Open `/dashboard/my-bookings`
2. Find CONFIRMED booking
3. Click "Cancel Ride" button
4. Verify dialog shows:
   - ✓ "Late cancellation" warning badge
   - ✓ "45 minutes until departure"
   - ✓ Cancellation rate: 33% (1 late + others = 1/3)
   - ✓ Orange color (30-50% range)
5. Click "Yes, Cancel"
6. Verify response:
   - ✓ Toast: "Booking Cancelled - Your seat has been released"
   - ✓ Card shows cancelled badge
   - ✓ Cancel button disabled

**Expected Database State:**
```firestore
booking/BOOKING_ID:
  status: 'CANCELLED'
  isLateCancellation: true
  cancelledAt: <timestamp>
  cancelledBy: <passenger_uid>

user/PASSENGER_UID:
  lateCancellations: 1
  totalCancellations: 1
  totalParticipations: 3
  cooldownUntil: <24h from now>

ride/RIDE_ID:
  availableSeats: 2 (incremented from 1)
```

### Scenario 3: Account Auto-Lock Trigger

**Setup:**
```
- User has 5 total bookings
- User has already cancelled 2 (40% rate)
- Next cancellation will trigger lock
```

**Test:**
1. Open `/dashboard/my-bookings`
2. Scroll to a CONFIRMED booking
3. Click "Cancel Ride"
4. Verify critical warning:
   - ✓ Red badge
   - ✓ "40% cancellation rate"
   - ✓ "Accounts with >35% rate are auto-locked for 7 days"
5. Click "Yes, Cancel"
6. Verify response:
   - ✓ Toast: "Cancellation recorded"
   - ✓ Can still interact with UI (lock async)

**Expected Database Post-Cancel:**
```firestore
user/PASSENGER_UID:
  totalCancellations: 3
  totalParticipations: 5
  lateCancellations: 1
  accountLockUntil: <timestamp + 7 days>

// Next API call should be rejected
POST /api/requests/cancel → 403 Locked
{
  "message": "Account locked. Try again in 10080 minutes"  // 7 days
}
```

### Scenario 4: Locked Account Cannot Cancel

**Setup:**
```
- User's accountLockUntil is set to <future date>
```

**Test:**
1. Open `/dashboard/my-bookings`
2. Try to click "Cancel Ride"
3. Click "Yes, Cancel"
4. Verify error:
   - ✓ Toast (red): "Account Locked - Your account has been temporarily locked"
   - ✓ Dialog closes
   - ✓ No cancellation recorded

**Expected Request:**
```
POST /api/requests/cancel
+ accountLockUntil timestamp valid

Response: 403
{
  "message": "Account locked. Try again in 10080 minutes"
}
```

### Scenario 5: Duplicate Cancellation Prevention

**Setup:**
```
- Booking is already in CANCELLED state
```

**Test:**
1. Try to cancel already-cancelled booking via:
   - a) API call directly
   - b) Two rapid clicks on Cancel button
   - c) Browser back-forward navigation after cancel
2. Verify second attempt returns error:
   - ✓ HTTP 400
   - ✓ Toast: "Booking already cancelled"
   - ✓ Database unchanged (no double-update)

### Scenario 6: Cannot Cancel After Departure

**Setup:**
```
- Ride departureTime is in the past
- Booking is CONFIRMED
```

**Test:**
1. Try to cancel the booking
2. Verify error:
   - ✓ Dialog opens but submit is disabled
   - ✓ Or error when clicking Yes: "Ride has already departed"
   - ✓ Toast (red): "Cannot cancel after ride has departed"

### Scenario 7: Rate Limiting on Cancel Requests

**Setup:**
```
- Use rapid-fire cancel button clicks
- Or make 20+ requests/minute to /api/requests/cancel
```

**Test:**
1. Make 21 requests within 60 seconds
2. Verify rate limiting:
   - ✓ First 20: succeed or have proper latency
   - ✓ Request 21+: 429 Too Many Requests
   - ✓ Toast: "Rate limited - please wait"

### Scenario 8: Passenger Dialog in Find-Rides

**Setup:**
```
- User browsing available rides
- User has pending request on a ride
```

**Test:**
1. Open Find Rides page
2. Scroll to ride with pending request
3. See "Request Pending" section with Cancel button
4. Click Cancel
5. Verify dialog appears with:
   - ✓ "Cancel Request" title
   - ✓ `cancellerRole="passenger"`
   - ✓ Confirmation button enabled
6. Click Yes
7. Verify:
   - ✓ Toast: "Request Cancelled"
   - ✓ Pending section disappears
   - ✓ Ride status refreshes

### Scenario 9: Three Cancel Points in Bookings Dashboard

**Setup:**
```
- User has bookings in different states
```

**Test:**
1. Pending booking (not confirmed):
   - ✓ Click Cancel Request button
   - ✓ Dialog appears
   - ✓ Confirm and cancel
2. Accepted booking (awaiting confirmation):
   - ✓ Click Cancel button
   - ✓ Dialog appears with orange warning
   - ✓ Confirm and cancel
3. CONFIRMED booking (confirmed by user):
   - ✓ See green "Ride Confirmed!" badge
   - ✓ Click Cancel Ride button
   - ✓ Dialog appears with "late cancellation" warning
   - ✓ Confirm and cancel

**Each should:**
- ✓ Update request/booking status to CANCELLED
- ✓ Update cancellation metrics
- ✓ Notify driver
- ✓ Release seats appropriately

### Scenario 10: Concurrent Cancellations

**Setup:**
```
- Two passengers about to cancel same ride
- Open two browser tabs with same ride
```

**Test:**
1. Tab 1: Cancel booking → succeeds
2. Tab 2: Cancel same booking → fails with "already cancelled"
3. Verify:
   - ✓ Both transactions attempted
   - ✓ Only first succeeds
   - ✓ Metrics not double-counted
   - ✓ Both users notified appropriately

## Automated Test Cases

### Unit Tests: `rideCancellationService.ts`

```typescript
describe('rideCancellationService', () => {
  describe('validateCancellationPermission', () => {
    it('returns allowed=true if departure is in future', () => {
      // Test with ride 2 hours from now
      // Expected: { allowed: true, minutesUntilDeparture: 120 }
    });

    it('returns allowed=false if departure is in past', () => {
      // Test with ride 1 hour ago
      // Expected: { allowed: false, minutesUntilDeparture: -60 }
    });

    it('accepts Timestamp and Date objects', () => {
      // Test both Firestore Timestamp and JavaScript Date
    });
  });

  describe('calculateCancellationRate', () => {
    it('returns 0 for no cancellations', () => {
      // { totalParticipations: 5, totalCancellations: 0 }
      // Expected: 0
    });

    it('returns 100 for all cancellations', () => {
      // { totalParticipations: 3, totalCancellations: 3 }
      // Expected: 100
    });

    it('rounds to nearest integer', () => {
      // { totalParticipations: 3, totalCancellations: 1 }
      // Expected: 33 (not 33.333...)
    });
  });

  describe('shouldLockAccount', () => {
    it('returns false if rate < 35%', () => {
      // 2/5 = 40% BUT < 3 participations
      // Expected: false
    });

    it('returns false if participations < 3', () => {
      // 1/2 = 50% BUT only 2 participations
      // Expected: false
    });

    it('returns true if rate > 35% AND participations >= 3', () => {
      // 2/5 = 40% AND 5 >= 3
      // Expected: true
    });

    it('returns false if rate exactly 35%', () => {
      // 7/20 = 35% exactly (boundary test)
      // Expected: false (uses > not >=)
    });
  });

  describe('isLateCancellation', () => {
    it('returns true for CONFIRMED status', () => {
      // Expected: true
    });

    it('returns true for Confirmed (lowercase)', () => {
      // Case-insensitive test
      // Expected: true
    });

    it('returns false for PENDING', () => {
      // Expected: false
    });

    it('returns false for ACCEPTED', () => {
      // Expected: false
    });
  });
});
```

### Integration Tests: API Endpoints

```typescript
describe('POST /api/requests/cancel', () => {
  it('returns 400 if ride has departed', async () => {
    // Create ride with past departure time
    // POST cancel request
    // Expected: 400, message includes "departed"
  });

  it('returns 403 if account is locked', async () => {
    // Set user.accountLockUntil = future date
    // POST cancel request
    // Expected: 403, message includes "locked"
  });

  it('returns 400 if booking already cancelled', async () => {
    // Set booking.status = 'CANCELLED'
    // POST cancel request
    // Expected: 400, message includes "already cancelled"
  });

  it('updates seats correctly for CONFIRMED booking', async () => {
    // Create ride with 2 available seats
    // Create CONFIRMED booking
    // Cancel booking
    // Expected: ride.availableSeats = 3
  });

  it('applies 7-day lock if rate > 35%', async () => {
    // Create user with 4/10 cancellation rate
    // POST cancel (rate becomes 5/11 = 45%)
    // Expected: user.accountLockUntil is ~7 days in future
  });

  it('applies 24-hour cooldown if 3+ late cancellations', async () => {
    // Create user with 2 late cancellations
    // POST cancel with late cancellation
    // Expected: user.cooldownUntil is ~24 hours in future
  });
});
```

## Performance Tests

### Load Testing: 1000 Concurrent Cancellations

```bash
# Use k6 or similar tool
export const options = {
  vus: 100,  // 100 virtual users
  duration: '10s',
};

export default function() {
  const payload = JSON.stringify({
    university: 'FAST',
    rideId: randomRideId(),
    requestId: randomBookingId(),
    reason: 'Test cancellation',
  });

  const response = http.post('https://api.campusride.com/api/requests/cancel', payload);
  check(response, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**Expected Results:**
- ✓ 99% of requests < 500ms
- ✓ No timeouts
- ✓ All transactions atomic (no partial updates)
- ✓ Zero notification loss

## Production Monitoring

### Key Metrics to Track

1. **Cancellation Volume**
   - Cancellations per hour
   - Cancellations by university
   - Cancellations by time-to-departure

2. **Account Locks**
   - New locks per day
   - Users affected (unique)
   - Common cancellation rates

3. **Error Rates**
   - 400 errors (invalid state)
   - 403 errors (locked/unauthorized)
   - 429 errors (rate limited)
   - 500 errors (server issues)

4. **API Performance**
   - Average response time
   - 95th percentile response time
   - Database query execution time

5. **Notification Delivery**
   - Notifications sent
   - Notifications delivered
   - Notification failures

### Alert Thresholds

- [ ] Alert if cancellation rate > 100/hour
- [ ] Alert if account locks > 50/day
- [ ] Alert if error rate > 1%
- [ ] Alert if avg response time > 200ms
- [ ] Alert if notification failure > 5%

## Regression Testing Checklist

After any changes to cancellation system:

- [ ] Driver can cancel rides
- [ ] Passenger can cancel bookings
- [ ] Account locks work
- [ ] Duplicate cancellations prevented
- [ ] Metrics updated correctly
- [ ] Notifications sent
- [ ] UI dialogs show correctly
- [ ] Rate limiting enforced
- [ ] Firestore rules pass
- [ ] No unhandled exceptions
- [ ] Error messages are user-friendly
- [ ] Cancelled rides/bookings hidden from lists
- [ ] Seats released correctly
- [ ] Historical data preserved

---

**Last Updated**: $(date)
**Ready for**: Testing in staging before production release
