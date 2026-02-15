# Notification System - Quick Test Guide

## Problem That Was Fixed
**The Core Issue:** All API routes were importing notification functions from `@/lib/rideNotificationService`, which uses the **client-side Firebase SDK** (`firebase/firestore`). However, these functions were being called with the **Admin SDK** Firestore instance (`admin.firestore`). 

**Why it failed:** Client-side SDK methods like `addDoc()` and `collection()` cannot work with Admin SDK instances. This caused silent failures - the API calls would succeed, but no notification documents were ever created in Firestore.

**The fix:** Created `@/lib/serverNotificationService.ts` which uses the Admin SDK correctly, and updated all 5 API routes to import from the new service.

---

## How to Test

### Test 1: Ride Request Notification (Request → Driver)
1. Sign in as **Passenger Account A**
2. Go to "Find a Ride" → browse available rides
3. Click "Request Seat" on a ride offered by **Driver Account B**
4. **Expected:** 
   - See notification toast appear for driver
   - Driver sees unread count badge in "Notifications" sidebar
   - Driver goes to `/dashboard/notifications` → sees "Ride request from Passenger A"

### Test 2: Request Acceptance Notification (Driver → Passenger)
1. Sign in as **Driver Account B**
2. Go to "My Rides" → find pending request from Passenger A
3. Click "Accept"
4. **Expected:**
   - Notification toast appears for passenger
   - Passenger sees badge update on "Notifications"
   - Passenger in notification center sees "Request Accepted ✅"

### Test 3: Request Rejection Notification (Driver → Passenger)
1. Sign in as **Driver Account B**
2. Go to "My Rides" → find another pending request
3. Click "Reject"
4. **Expected:**
   - Notification sent with "Request Rejected ❌"
   - Passenger receives it in real-time

### Test 4: Ride Confirmation Notification (Passenger → Driver)
1. Sign in as **Passenger Account A** with accepted request
2. Navigate to ride details
3. Click "Confirm Seat"
4. **Expected:**
   - Driver receives "Seat Confirmed! 🎉" notification
   - Driver sees it in notification center

### Test 5: Ride Cancellation (Either party)
1. Sign in as either user with active booking
2. Go to ride → click "Cancel"
3. **Expected:**
   - Other party receives cancellation notification
   - Late cancellation flag applied if needed

### Test 6: Notification Center UI
1. Sign in to any account
2. Go to `/dashboard/notifications`
3. **Expected:**
   - See all notifications
   - Unread ones have blue background + indicator
   - Can filter by "Unread" tab
   - Can mark individual as read
   - Can mark all as read
   - Can delete notifications
   - Can click to view related ride

### Test 7: Mobile Experience
1. Open app on mobile or mobile-size viewport
2. Tap bell icon in top-right header
3. **Expected:**
   - See notification bell with unread count
   - Can tap "Alerts" in bottom nav
   - Notification center is responsive

### Test 8: Notification Badges
1. Have multiple unread notifications
2. **Expected in Desktop:**
   - Sidebar "Notifications" shows count badge
   - Notification bell might show count (depends on implementation)

3. **Expected on Mobile:**
   - Bell icon shows red badge with count
   - "Alerts" tab shows dot indicator
   - Badge updates in real-time as notifications arrive

### Test 9: Real-Time Updates
1. Open `/dashboard/notifications` in **Browser Tab A**
2. In **Browser Tab B**, trigger an action that creates a notification (acceptance, request, etc.)
3. **Expected:** 
   - **Tab A** updates automatically within 1-2 seconds
   - No page refresh needed
   - Toast appears if app is in foreground

### Test 10: Firestore Document Creation (Dev Tools)
1. Open Firebase Console
2. Navigate to Firestore → `universities/{university}/notifications`
3. Trigger a notification (request, acceptance, etc.)
4. **Expected:**
   - New document appears with:
     ```
     {
       userId: "{recipient-id}",
       type: "ride_requested",
       title: "New Ride Request",
       message: "Student X requested your ride...",
       isRead: false,
       createdAt: Server Timestamp,
       relatedRideId: "{rideId}",
       priority: "high"
     }
     ```

---

## Visual Indicators

### Notification Types & Icons
| Type | Icon | Color | Meaning |
|------|------|-------|---------|
| `ride_requested` | 🗺️ MapPin | Blue | Passenger requesting your ride |
| `request_accepted` | ✅ CheckCheck | Green | Driver accepted your request |
| `request_rejected` | ❌ AlertCircle | Red | Request was rejected |
| `ride_confirmed` | ✅ CheckCheck | Green | Passenger confirmed seat |
| `ride_cancelled` | ❌ AlertCircle | Red | Ride was cancelled |
| `ride_started` | ▶️ MapPin | Blue | Driver started the trip |
| `ride_completed` | ✅ CheckCheck | Green | Trip is complete |
| `chat_message` | 💬 MessageCircle | Purple | New message in chat |
| `call_missed` | 📞 Phone | Orange | Missed call |

### Badge indicators
- **Sidebar:** Colored badge with count (e.g., "12") next to "Notifications"
- **Mobile Bell:** Red badge, top-right of icon
- **Mobile Nav:** Dot indicator on "Alerts" tab
- **Notification Card:** Blue dot on left if unread

---

## Debugging Tips

### If notifications aren't appearing:
1. **Check browser console:** Look for error messages
2. **Check Firebase Console:** Verify notification doc was created in `universities/{uni}/notifications`
3. **Check Firestore Rules:** Ensure rules allow reading notifications
4. **Verify university:** Make sure both users are in same university
5. **Check API response:** In Network tab, verify API route returned success

### If notifications are appearing but not updating in real-time:
1. Check browser console for errors
2. Verify NotificationContext is subscribed correctly
3. Check Firestore listener is active (should see logs in console)
4. Try refreshing page to verify data is in Firestore

### Log messages to watch for:
```
[serverNotificationService] Creating notification: {userId, type, title}
[NotificationContext] Notification received: {type, title}
[Firestore] onSnapshot listener triggered
```

---

## Success Criteria
✅ All API routes using serverNotificationService
✅ Notification documents created in Firestore upon action
✅ Real-time toast notifications appear
✅ Notification center page shows all notifications
✅ Unread badges display correctly
✅ Can mark as read / delete
✅ Mobile experience works
✅ No TypeScript build errors

---

## Rollback (if needed)
If critical issues:
1. Revert import statements in 5 API routes back to `@/lib/rideNotificationService`
2. Rebuild: `npm run build`
3. Restart server

But this will return to the broken state. Better option: Check logs for actual issue.
