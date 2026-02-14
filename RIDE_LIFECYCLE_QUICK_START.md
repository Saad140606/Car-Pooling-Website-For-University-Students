# Ride Lifecycle — Developer Quick Start

## Using the Lifecycle Hook

### Basic Usage

```typescript
'use client';

import { useRideLifecycle } from '@/hooks/useRideLifecycle';

export function MyRideComponent({ rideId, university }: { rideId: string; university: string }) {
  const { state, ui, actions, isLoading, error } = useRideLifecycle(rideId, university);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!state) return <div>Ride not found</div>;

  return (
    <div>
      <h2>Status: {ui.statusLabel}</h2>
      <p>{state.confirmedPassengers.length} / {state.totalSeats} seats confirmed</p>
      
      {ui.canComplete && (
        <button onClick={() => actions.completeRide()}>Complete Ride</button>
      )}
      
      {ui.canRate && (
        <button onClick={() => actions.submitRating(state.driverId, 5)}>Rate Driver</button>
      )}
    </div>
  );
}
```

### State Object

```typescript
interface LifecycleState {
  status: RideStatus; // Current state in state machine
  departureTime: Date | null;
  totalSeats: number;
  availableSeats: number;
  reservedSeats: number;
  confirmedPassengers: RidePassenger[];
  pendingRequests: RidePassenger[];
  cancelledPassengers: RidePassenger[];
  completionWindowEnd: Date | null;
  ratingsOpen: boolean;
  driverId: string;
  from: string;
  to: string;
  price: number;
  rideId: string;
  transitionLog: Array<{ from: string; to: string; reason?: string }>;
}
```

### UI State Object

```typescript
interface LifecycleUIState {
  isLocked: boolean; // Ride has locked (departure reached)
  isTerminal: boolean; // Ride is in final state
  canCancel: boolean; // Cancellation still allowed
  canBook: boolean; // New bookings allowed
  canRate: boolean; // Ratings can be submitted
  userRole: 'driver' | 'passenger' | 'viewer';
  statusLabel: string; // Human-readable status
  isActive: boolean; // Ride is in progress
  canComplete: boolean; // Driver can mark as complete
  minutesUntilDeparture: number | null;
}
```

### Action Types

```typescript
interface LifecycleActions {
  completeRide: () => Promise<void>;
  cancelRide: (reason?: string) => Promise<void>;
  markNoShow: (passengerId: string) => Promise<void>;
  submitRating: (ratedUserId: string, rating: number) => Promise<void>;
  initLifecycle: () => Promise<void>;
}
```

---

## Using the UI Component

### Compact Badge

```typescript
import { RideLifecycleBadge } from '@/components/ride-lifecycle/RideLifecycleStatus';

export function RideCard({ rideId, university }: Props) {
  return (
    <div className="ride-card">
      <RideLifecycleBadge rideId={rideId} university={university} />
      {/* rest of ride info */}
    </div>
  );
}
```

### Full Dashboard

```typescript
import { RideLifecycleStatus } from '@/components/ride-lifecycle/RideLifecycleStatus';

export function RideDetailPage({ rideId, university }: Props) {
  return (
    <div className="ride-detail">
      <RideLifecycleStatus
        rideId={rideId}
        university={university}
        showActions={true}
        onRatingSubmitted={() => console.log('Rating submitted!')}
      />
    </div>
  );
}
```

### Props

```typescript
interface RideLifecycleStatusProps {
  rideId: string;
  university: string;
  compact?: boolean; // Default: false
  showActions?: boolean; // Default: true
  onRatingSubmitted?: () => void;
}
```

---

## State Machine Diagram

```
CREATED
   ↓
OPEN (accepting bookings)
   ↓
REQUESTED (passengers submitting requests)
   ↓
ACCEPTED (driver has accepted some)
   ↓
CONFIRMED (at least one passenger confirmed)
   ↓
LOCKED (departure time reached, auto)
   ↓
IN_PROGRESS (ride started, auto after 10 min)
   ↓
COMPLETION_WINDOW (ratings open, 1 hour window)
   ↓
COMPLETED (driver confirms or window expires)

OR FAILED (if no confirmed passengers by lock time)
OR CANCELLED (driver cancels before LOCKED)
```

---

## Common Patterns

### Check If Driver

```typescript
const isDriver = ui.userRole === 'driver';
```

### Check If Passenger Can Book

```typescript
if (ui.canBook) {
  // Show "Request Ride" button
}
```

### Check If Ride Has Departed

```typescript
if (ui.isLocked) {
  // Ride is locked (departed)
}
```

### Handle Async Actions

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleComplete = async () => {
  setIsSubmitting(true);
  try {
    await actions.completeRide();
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Real-time Updates

Hook listens to `universities/{univ}/rides/{rideId}` with `onSnapshot`:

```typescript
// Automatically re-renders when ride document changes
const { state } = useRideLifecycle(rideId, university);
// state.status updates in real-time
```

---

## Status Labels

| Status | Label | Driver Can Edit |
|--------|-------|-----------------|
| CREATED | Created | Yes |
| OPEN | Open for Booking | Yes |
| REQUESTED | Requests Pending | Yes |
| ACCEPTED | Requests Accepted | Yes |
| CONFIRMED | Seats Confirmed | No (locked) |
| LOCKED | Ride Locked | No |
| IN_PROGRESS | In Progress | Can complete |
| COMPLETION_WINDOW | Awaiting Completion | Can complete |
| COMPLETED | Completed | No |
| FAILED | Failed — No Passengers | N/A |
| CANCELLED | Cancelled | No |

---

## Lifecycle Flow Example

1. **Create Ride** (Status: CREATED → OPEN)
   ```javascript
   //Auto-called by create-ride page
   await actions.initLifecycle();
   ```

2. **Passenger Requests** (Status remains OPEN)
   - Multiple passengers can request
   - Driver sees requests list

3. **Driver Accepts Request** (Status: OPEN → REQUESTED → ACCEPTED)
   - Seat is reserved
   - Passenger has 5-30 minutes to confirm (depending on departure time)

4. **Passenger Confirms** (Status: ACCEPTED → CONFIRMED)
   - Seat is confirmed/deducted
   - Other passenger requests for same trip auto-cancelled
   - If all seats filled: Status becomes FULL

5. **Departure Time Arrives** (Status: CONFIRMED → LOCKED → IN_PROGRESS)
   - Cloud Function automatically transitions
   - No more bookings allowed
   - All participants notified

6. **10 Minutes After Departure** (Status: IN_PROGRESS → COMPLETION_WINDOW)
   - Ratings window opens (1 hour)
   - Driver can mark ride as complete

7. **Driver Completes or 1 Hour Passes** (Status: COMPLETION_WINDOW → COMPLETED)
   - Ratings become immutable/permanent
   - Per-ride data archived

---

## Error Handling

### Common Errors

```typescript
try {
  await actions.completeRide();
} catch (err) {
  if (err.message.includes('too late')) {
    // Ride already completed or too late
  } else if (err.message.includes('passenger')) {
    // Issue with passenger data
  } else {
    // Generic network/auth error
  }
}
```

### API Errors

All lifecycle APIs return:

```typescript
{
  ok: boolean;
  error?: string; // Only if ok === false
  data?: any; // Only if ok === true
}
```

---

## Performance Notes

- **Real-time listener**: Watches one ride document (minimal cost)
- **Snapshot size**: ~2KB per ride (plus passengers array)
- **API calls**: Only when user takes action (rate, complete, etc.)
- **Cloud Functions**: Run every 1-2 minutes but only process changed rides

---

## Debugging

### View State in Console

```typescript
const { state } = useRideLifecycle(rideId, university);
console.log('Lifecycle state:', state);
console.log('Transition history:', state?.transitionLog);
```

### Firestore Inspection

```javascript
// View current lifecycle state
db.collection('universities').doc(univId)
  .collection('rides').doc(rideId).get()
  .then(snap => console.log(snap.data().lifecycleStatus))
```

### Component Props

```typescript
<RideLifecycleStatus
  rideId={rideId}
  university={university}
  compact={false}
  showActions={true}
  onRatingSubmitted={() => alert('Rated!')}
/>
```

---

## Integration Checklist

- [ ] Hook imported from `@/hooks/useRideLifecycle`
- [ ] Component imported from `@/components/ride-lifecycle/RideLifecycleStatus`
- [ ] `university` and `rideId` props provided
- [ ] Action handlers use try/catch
- [ ] Loading states hidden UI elements
- [ ] Error messages displayed to user
- [ ] Rating dialog closes after submission
- [ ] Cancellation reason trimmed/sanitized
- [ ] No-show only shown in COMPLETION_WINDOW
- [ ] User role checked before showing driver-only actions

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Status**: Production Ready
