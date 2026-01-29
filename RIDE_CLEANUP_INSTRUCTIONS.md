# Ride Auto-Deletion Setup

## Problem
Rides should automatically be deleted 12 hours after their departure time, but they're still showing up.

## Solution

### Option 1: Manual Cleanup (Immediate Fix)

Run the cleanup script manually to expire and delete old rides:

```bash
node scripts/expire-rides.js
```

This script will:
1. Mark all rides with past departure times as `expired`
2. Permanently delete rides that are 12+ hours past their departure time
3. Clean up related bookings, requests, chats, and call data

**For Production:**
Set your Firebase credentials first:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
node scripts/expire-rides.js
```

**For Local Emulator:**
```bash
export FIRESTORE_EMULATOR_HOST="localhost:8080"
node scripts/expire-rides.js
```

### Option 2: Automated Cleanup (Scheduled Functions)

Deploy the Cloud Functions to run automatically:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

**Note:** Scheduled functions require:
- Firebase Blaze (pay-as-you-go) plan
- Cloud Scheduler API enabled in Google Cloud Console

The functions will run:
- `expireRides`: Every 5 minutes - marks past rides as expired
- `deleteExpiredRides`: Every 10 minutes - deletes rides 12+ hours past departure

### Option 3: Client-Side Filtering (Already Implemented)

The My Rides page now automatically hides rides that are 12+ hours past departure, even if they haven't been deleted from the database yet. This provides immediate UX improvement while the backend cleanup runs.

## Recommended Workflow

1. **Immediate:** Run `node scripts/expire-rides.js` now to clean up existing old rides
2. **Short-term:** Set up a cron job to run the script daily:
   ```bash
   # Linux/Mac crontab
   0 0 * * * cd /path/to/project && node scripts/expire-rides.js
   
   # Windows Task Scheduler
   # Create a scheduled task to run the script daily
   ```
3. **Long-term:** Deploy Cloud Functions for fully automated cleanup

## Verification

After running the cleanup:

1. Check the console output for number of rides expired/deleted
2. Refresh your My Rides page - old rides should be gone
3. Check Firestore console to verify documents are deleted

## Troubleshooting

**Script fails with permission error:**
- Ensure Firebase Admin SDK is initialized correctly
- Check your service account key has proper permissions

**Rides still showing:**
- Clear browser cache and refresh
- Check the ride's departureTime in Firestore console
- Verify the script completed successfully (check console output)

**Want to adjust the 12-hour window:**
Edit `scripts/expire-rides.js` and change:
```javascript
const twelveHoursMs = 12 * 60 * 60 * 1000; // Change 12 to your desired hours
```
