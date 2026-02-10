# Logged-Out User Flow Implementation Guide

## Overview
Implemented a new user flow for logged-out users in the "Find a Ride" section. Now when logged-out users click "Request Seat" or "Book", they see a modal with options to select "Request Pickup" or "Request Dropoff" before being redirected to the university selection page.

## User Flow

### Before (Old Flow)
```
Logged-out user clicks "Book" 
    ↓
Shows error: "Sign in required"
    ↓
User confused - exits
```

### After (New Flow)
```
Logged-out user clicks "Request Seat"
    ↓
Modal appears: "Request a Ride"
    ↓
User selects "Request Pickup" or "Request Dropoff"
    ↓
User clicks "Continue to Sign In"
    ↓
Redirected to: /auth/select-university/
    ↓
After selecting university and signing up, pending ride request is retained
```

## Components Created/Modified

### 1. New Component: `RequestPickupModal` ✅
**File:** [src/components/RequestPickupModal.tsx](src/components/RequestPickupModal.tsx)

**Features:**
- Shows ride details (origin, destination, price)
- Two options: "Request Pickup" and "Request Dropoff"
- Displays which one the user selected
- Stores pending ride request in sessionStorage for post-login/signup retrieval
- Redirects to `/auth/select-university/` on confirmation

**Props:**
```typescript
interface RequestPickupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: RideType;
  requestType?: 'pickup' | 'dropoff' | 'both'; // 'both' shows both options
}
```

### 2. Modified: `page-premium.tsx` ✅
**File:** [src/app/dashboard/rides/page-premium.tsx](src/app/dashboard/rides/page-premium.tsx)

**Changes:**
- Added `RequestPickupModal` import
- Added state for modal management:
  ```typescript
  const [requestPickupOpen, setRequestPickupOpen] = useState(false);
  const [selectedRideForRequest, setSelectedRideForRequest] = useState<RideType | null>(null);
  ```
- Modified `handleBook` function to:
  - Check if user is logged in
  - If NOT logged in: Show the RequestPickupModal instead of error toast
  - If logged in: Proceed with normal booking flow
- Added modal component to JSX:
  ```tsx
  {selectedRideForRequest && (
    <RequestPickupModal
      open={requestPickupOpen}
      onOpenChange={setRequestPickupOpen}
      ride={selectedRideForRequest}
      requestType="both"
    />
  )}
  ```

## Session Storage Integration

When a logged-out user confirms their pickup/dropoff preference, the modal stores the ride request info:

```javascript
sessionStorage.setItem('pendingRideRequest', JSON.stringify({
  rideId: ride.id,
  university: ride.university || 'ned',
  requestType: selectedType,  // 'pickup' or 'dropoff'
  rideDetails: {
    from: ride.from,
    to: ride.to,
    price: ride.price,
    departureTime: ride.departureTime,
  },
}));
```

**Next steps (for future implementation):**
1. After user signs up at `/auth/select-university/`, retrieve this from sessionStorage
2. Automatically select the ride they chose
3. Proceed with booking once they confirm their location

## Usage Example

```typescript
// In your page component:
import { RequestPickupModal } from '@/components/RequestPickupModal';

// In your handleBook or handleRequest function:
if (!user) {
  const ride = rides?.find((r) => r.id === rideId);
  if (ride) {
    setSelectedRideForRequest(ride);
    setRequestPickupOpen(true);  // Show modal
  }
  return;
}

// Then in your JSX:
{selectedRideForRequest && (
  <RequestPickupModal
    open={requestPickupOpen}
    onOpenChange={setRequestPickupOpen}
    ride={selectedRideForRequest}
    requestType="both"  // or 'pickup' or 'dropoff' only
  />
)}
```

## Testing Checklist

- [ ] As logged-out user, click "Request Seat" on any ride
- [ ] Modal appears with ride details
- [ ] Can select "Request Pickup"
- [ ] Can select "Request Dropoff"
- [ ] Clicking "Continue to Sign In" redirects to `/auth/select-university/`
- [ ] sessionStorage contains pending ride request
- [ ] Modal closes after redirect
- [ ] Logged-in users still see normal booking flow (no modal)

## Styling Details

### Modal Design
- Dark theme matching app aesthetic (slate-900/950)
- Primary color accents for selected state
- Icons: MapPin (pickup), Navigation2 (dropoff)
- Clear visual feedback for selection
- Info banner explaining next steps
- Disabled state when no option selected

### Color States
- **Selected:** Primary color background with border
- **Unselected:** Slate-700 border, hover state
- **Processing:** Disabled button with loading text
- **Info banner:** Blue accent color

## Related Files
- [Select University Page](src/app/auth/select-university/page.tsx) - Where user redirects to
- [Rides Premium Page](src/app/dashboard/rides/page-premium.tsx) - Where modal is used
- [Dialog UI Component](src/components/ui/premium-dialog.tsx) - Modal underlying component

## Future Enhancements

1. **Auto-fill after signup:** Retrieve sessionStorage data and auto-select the ride
2. **Request tracking:** Show "You have pending request" before booking
3. **Analytics:** Track how many logged-out users complete this flow
4. **Personalization:** Remember user's preference (pickup vs dropoff)
5. **Multiple universities:** Handle cross-university ride requests

## Notes

- The modal appearance is conditional - only shows when `requestPickupOpen` is true and `selectedRideForRequest` exists
- Session storage is used (not localStorage) so data is cleared when browser tab closes
- Graceful fallback if sessionStorage fails - user can still complete signup manually
- No analytics tracking yet - can be added to track conversion rates

---

**Implementation Date:** February 10, 2026
**Status:** ✅ Complete for Premium UI
**Next Step:** Apply to regular page.tsx if needed (same approach)
