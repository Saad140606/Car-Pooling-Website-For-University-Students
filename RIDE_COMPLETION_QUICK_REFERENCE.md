# 🎯 RIDE COMPLETION SYSTEM - QUICK REFERENCE

## 🔧 KEY FILES

| File | Purpose |
|------|---------|
| `src/config/lifecycle.ts` | **⚠️ CHANGE HERE** for testing (5 min) vs production (60 min) |
| `src/hooks/useRideLifecycleMonitor.ts` | Client-side time checker (runs every 15 seconds) |
| `src/app/api/ride-lifecycle/check-status/route.ts` | API fallback to trigger status updates |
| `src/app/dashboard/my-rides/page.tsx` | Driver completion UI |
| `src/app/dashboard/my-bookings/page.tsx` | Passenger completion UI |
| `functions/src/rideLifecycleScheduler.ts` | Cloud Functions (run every 1-2 minutes) |

## ⚙️ CHANGE BETWEEN TESTING & PRODUCTION

**File**: `src/config/lifecycle.ts`

```typescript
// TESTING MODE (5 minutes)
COMPLETION_DELAY_MINUTES: 5,

// PRODUCTION MODE (1 hour)
COMPLETION_DELAY_MINUTES: 60,
```

**Then redeploy**:
```bash
npm run build
firebase deploy --only functions
# Deploy Next.js to hosting
```

## 📊 HOW IT WORKS

```
Ride Created (T+0)
    ↓
Departure Time (T+6 min) → Status: IN_PROGRESS
    ↓
5 minutes pass (T+11 min) → Status: COMPLETION_WINDOW
    ↓
    ├─ Driver Sees: 🚀 Complete Your Ride
    └─ Passenger Sees: 🎉 Complete Your Ride
    ↓
User Completes → Status: COMPLETED
    ↓
Rating UI Appears
```

## 🚨 CRITICAL TIMING

| Event | Timing | Status |
|-------|--------|--------|
| Ride Created | T+0 | OPEN |
| Departure Time | T+6 min | IN_PROGRESS (if passengers exist) |
| Completion Window Opens | T+11 min (testing)<br>T+66 min (production) | COMPLETION_WINDOW |
| Completion UI Shown | Immediately when COMPLETION_WINDOW | Both driver & passengers see it |

## 🔄 UPDATE TRIGGERS

**3 Ways Status Gets Updated**:
1. **Cloud Functions Scheduler** (every 1-2 minutes) - Primary method
2. **Client-Side Monitor** (every 15 seconds) - Triggers API when needed
3. **Manual API Call** - Can manually trigger `/api/ride-lifecycle/check-status`

**All 3 work together** for deterministic, reliable updates.

## 🧪 QUICK TEST

1. Create ride with departure = NOW + 6 minutes
2. Have passenger confirm
3. Wait 11 minutes
4. Open browser console
5. Look for: `[LifecycleMonitor] State check:`
6. Both driver & passenger should see completion panels

**Expected Console Output**:
```
[LifecycleMonitor] State check: {
  rideId: "abc123",
  lifecycleStatus: "COMPLETION_WINDOW",
  minutesUntilCompletion: -1,
  shouldShowUI: true
}
```

## 🏥 HEALTH CHECK

**Open Console and Check**:
- [ ] Logs appear every 15 seconds?
- [ ] lifecycleStatus field in Firestore updating?
- [ ] Cloud Functions logs show schedulers running?
- [ ] Completion UI visible after 5 min?

**If No**:
1. Check Cloud Functions deployed: `firebase functions:list`
2. Check console for errors
3. Manually call API: `POST /api/ride-lifecycle/check-status`

## ⚡ DEPLOYMENT COMMANDS

```bash
# Full deployment
cd functions
npm run build
firebase deploy --only functions
cd ..
npm run build
# Deploy to hosting

# Check if functions deployed
firebase functions:list | grep lifecycle

# View function logs
firebase functions:log --only lifecycleCompletionManager
```

## 🎨 UI APPEARANCE

**Driver (My Rides)**:
- Large pulsing green panel at top of card
- List of passengers with "Completed" / "No-show" buttons
- Big "✓ Mark Ride Complete" button
- Can't be missed!

**Passenger (My Bookings)**:
- Large pulsing green panel at top of card
- Two big buttons: "✓ Ride Completed" and "✗ Report Issue"
- If reporting issue: Select reason from list
- Can't be missed!

## 🚦 STATUS FLOW

```
OPEN → LOCKED → IN_PROGRESS → COMPLETION_WINDOW → COMPLETED
               ↓ (if no passengers)
             FAILED
```

## 📱 TESTING CHECKLIST

- [ ] Ride transitions to IN_PROGRESS at departure
- [ ] Ride transitions to COMPLETION_WINDOW 5 min later (testing mode)
- [ ] Driver sees completion UI
- [ ] Passenger sees completion UI
- [ ] Console logs show monitor running
- [ ] Firestore updates visible
- [ ] Cloud Functions logs show activity
- [ ] Buttons work (Completed, No-show, Report Issue)
- [ ] After completion, status → COMPLETED
- [ ] Real-time updates work (no refresh needed)

## 🆘 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| UI never appears | Check console for `[LifecycleMonitor]` logs |
| Status stuck at IN_PROGRESS | Call `/api/ride-lifecycle/check-status` manually |
| Cloud Functions not running | Deploy: `firebase deploy --only functions` |
| API returns 401 | Check Authorization header has valid token |
| Wrong timing | Check `src/config/lifecycle.ts` value |

## 📞 EMERGENCY FIX

If nothing else works:
```bash
# Force status update via API
curl -X POST https://your-domain.com/api/ride-lifecycle/check-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"university":"YOUR_UNIV","rideId":"YOUR_RIDE_ID"}'
```

---

**For full details, see**: `RIDE_COMPLETION_SYSTEM_DEPLOYMENT.md`
