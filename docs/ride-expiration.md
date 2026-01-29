# Ride Expiration

Goal: prevent rides with past departure times from appearing in the "Find a Ride" UI while keeping them visible under "My Rides".

Approach
- A scheduled Cloud Function (or a small admin script) marks rides as `status: 'expired'` when `departureTime <= now`.
- `Find a Ride` already filters with `where('status', '==', 'active')` and `where('departureTime', '>', Timestamp.now())`. Marking the status ensures real-time clients see the change immediately.

Files
- `functions/src/index.ts` - Cloud Functions template: `expireRides` scheduled job (every 5 minutes).
- `scripts/expire-rides.js` - CLI/admin script that performs the same updates; useful for local emulator testing or cron jobs.

Deploy
- Functions: from `functions/` run `npm install` and `npm run build` then `firebase deploy --only functions`.
- The scheduler may require enabling Cloud Scheduler and billing (Blaze) for production. For local testing, use the Firestore emulator and run the script directly.

Testing locally
- Start Firestore emulator and populate test rides with `status: 'active'` and `departureTime` in the past.
- Run `node scripts/expire-rides.js` and confirm documents are updated to `status: 'expired'`.

Notes
- We update `status` to `expired` at departure time and add `expiredAt` for auditing.
- Automatic deletion runs 12 hours after departure for expired rides, removing related bookings, requests, chats, and call signaling docs.
- For local testing without the scheduler, run the admin script or invoke a one-off deletion by time range.
