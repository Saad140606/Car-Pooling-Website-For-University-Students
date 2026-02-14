# Quick Test Guide - Delete & Cancel Fix

## 🚀 Quick Start Testing (5 minutes)

### Prerequisites
- Local dev server running (`npm run dev`)
- Browser console open (F12 → Console tab)
- Test account logged in

---

## Test 1: Delete Ride with No Passengers ✅

**Steps:**
1. Go to "Offer Ride" and create a test ride
2. Go to "My Rides" and find your ride
3. Click the "Delete" button
4. Confirm deletion

**Expected Result:**
```
✅ Toast: "Ride Deleted - Your ride has been deleted successfully."
✅ Ride disappears from list
✅ Console shows: [DeleteRide] Transaction successful
```

**If It Fails:**
- Check console for `[DeleteRide]` logs
- Look for which validation step failed
- Common issue: Token expiration (should auto-refresh now)

---

## Test 2: Delete Ride with Confirmed Passengers ❌

**Steps:**
1. Create a ride
2. Have another user book it
3. Accept the booking request
4. Try to delete the ride

**Expected Result:**
```
❌ Toast: "Cannot Delete - This ride has 1 confirmed passenger..."
✅ Ride NOT deleted
✅ Console shows: [DeleteRide] Ride has accepted bookings
```

**If It Fails:**
- Check if booking status is actually "accepted"
- Verify acceptedCount > 0 in ride data
- Check preflight validation logs

---

## Test 3: Cancel Ride with Passengers ✅

**Steps:**
1. Create a ride with confirmed passengers
2. Click "Cancel Ride" button
3. Confirm cancellation

**Expected Result:**
```
✅ Toast: "Ride Cancelled - X passengers have been notified."
✅ Ride status changes to "Cancelled"
✅ Console shows: [CancelRide] Ride cancelled successfully
✅ Passengers receive cancellation notification
```

**If It Fails:**
- Check server logs for `[API:CancelRide]`
- Verify user is the ride driver
- Check if ride already departed

---

## Test 4: Network Error Handling 🌐

**Steps:**
1. Open DevTools → Network tab → Set to "Offline"
2. Try to delete or cancel a ride

**Expected Result:**
```
❌ Toast: "Network Error - Failed to connect to server..."
✅ Console shows: [DeleteRide] API call failed
✅ User gets clear instruction to check internet
```

**If It Fails:**
- Check if fetch is properly wrapped in try/catch
- Verify network error detection logic

---

## 🔍 Debugging Checklist

If any test fails, check these in order:

### 1. Browser Console
```javascript
// Should see these logs for successful delete:
[DeleteRide] Starting deletion process
[DeleteRide] Preflight checks passed
[DeleteRide] Calling backend API
[DeleteRide] Auth token obtained
[DeleteRide] API response status: 200
[DeleteRide] Ride deleted successfully
```

### 2. Server Logs
```
// Should see these logs on server:
[API:DeleteRide] Request received
[API:DeleteRide] Authenticated user: <uid>
[API:DeleteRide] Input: { university, rideId }
[API:DeleteRide] Ride found
[API:DeleteRide] Ownership verified
[API:DeleteRide] Transaction successful
```

### 3. Auth Middleware Logs
```
// Should see these for valid auth:
[verifyAuthToken] Verifying token...
[verifyAuthToken] Token verified successfully for user: <uid>
```

### 4. Common Issues

**Issue: "Authentication Failed"**
- Cause: Token expired
- Solution: Should auto-refresh now (forceRefresh: true)
- Check: Console shows "Auth token obtained"

**Issue: "Ride Not Found"**
- Cause: Ride already deleted or wrong ID
- Solution: Check rideId in console logs
- Check: Verify ride exists in Firestore

**Issue: "Permission Denied"**
- Cause: User not the owner
- Solution: Check driverId vs user.uid
- Check: Console shows ownership mismatch error

**Issue: "Cannot Delete - has accepted bookings"**
- Cause: Passengers confirmed (expected behavior)
- Solution: Use "Cancel Ride" instead
- Check: Console shows accepted count

---

## 📊 Monitoring Dashboard

### Real-Time Monitoring

Open browser console and run:
```javascript
// Filter for delete/cancel logs
console.filter = /\[DeleteRide\]|\[CancelRide\]/;
```

### Check All Errors
```javascript
// Show only errors
console.filter = /ERROR|error|failed/i;
```

---

## ✅ Success Indicators

You'll know the fix is working when:

1. **Delete operations succeed** for rides with no passengers
2. **Delete operations blocked** for rides with passengers (with clear message)
3. **Cancel operations succeed** for all rides
4. **Token expiration handled** automatically (no auth errors)
5. **Network errors detected** and reported clearly
6. **All console logs present** for debugging
7. **User-friendly error messages** for all scenarios

---

## 🆘 Emergency Rollback

If critical issues occur:

### Quick Rollback
```bash
# Revert the changes
git revert HEAD

# Rebuild
npm run build

# Deploy
npm run deploy
```

### Partial Rollback (Frontend Only)
```bash
# Revert just the frontend changes
git checkout HEAD~1 -- src/app/dashboard/my-rides/page.tsx

# Rebuild
npm run build
```

---

## 📞 Report Issues

If you find a problem, provide:

1. **Browser console logs** (copy all `[DeleteRide]` or `[CancelRide]` lines)
2. **Server logs** (copy all `[API:DeleteRide]` or `[API:CancelRide]` lines)
3. **Steps to reproduce** (what you clicked, what happened)
4. **Expected vs actual** (what should happen vs what happened)
5. **User account details** (UID, university, role)

Example report:
```
ISSUE: Delete button not working

Browser Console:
[DeleteRide] Starting deletion process
[DeleteRide] Failed to get auth token: FirebaseError...

Server Logs:
(none - request never reached server)

Steps:
1. Logged in as driver
2. Clicked delete on my ride
3. Nothing happened

Expected: Ride deleted
Actual: Silent failure

User: uid=abc123, university=uwi, role=driver
```

---

## 🎯 Testing Matrix

| Scenario | Delete | Cancel | Expected |
|----------|--------|--------|----------|
| No passengers | ✅ | ✅ | Both succeed |
| Pending bookings | ✅ | ✅ | Both succeed |
| Confirmed passengers | ❌ | ✅ | Delete blocked, Cancel succeeds |
| After departure | ❌ | ❌ | Both blocked |
| Not owner | ❌ | ❌ | Both blocked |
| Already cancelled | N/A | ❌ | Cancel blocked |
| Network offline | ❌ | ❌ | Both show network error |
| Token expired | ✅ | ✅ | Auto-refresh, then succeed |

---

## 🔧 Advanced Testing

### Test Rate Limiting
```javascript
// Rapid fire deletes (should be rate limited)
for (let i = 0; i < 20; i++) {
  fetch('/api/rides/delete', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ university, rideId })
  });
}
// Should see rate limit errors after ~10 requests
```

### Test Token Expiration
```javascript
// Use an old token (from 2 hours ago)
const oldToken = 'eyJ...(old token)...';
fetch('/api/rides/delete', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + oldToken },
  body: JSON.stringify({ university, rideId })
});
// Should see: "Token expired" error
```

### Test Invalid Input
```javascript
// Test with invalid ride ID
fetch('/api/rides/delete', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ 
    university: 'uwi',
    rideId: '../../etc/passwd'  // Path traversal attempt
  })
});
// Should see: "Invalid ride ID format" error
```

---

## 📈 Performance Testing

### Measure Delete Time
```javascript
console.time('delete');
// Click delete button
// Wait for completion
console.timeEnd('delete');
// Should be < 1000ms
```

---

**Ready to Test!** 🧪
