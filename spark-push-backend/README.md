# Spark Push Backend (No Cloud Functions)

Minimal external Node worker for Firebase Spark plan.

## What it does
- Watches `rides` collection for new request docs (`type: "request"`).
- Reads recipient token(s) from `users/{uid}.fcmToken`.
- Sends FCM push using Firebase Admin SDK.
- Writes delivery fields back to `rides/{rideId}`.

## Firestore shape

### users
```json
users/{uid} {
  "fcmToken": "FCM_TOKEN_STRING",
  "fcmTokenUpdatedAt": "timestamp"
}
```

### rides
```json
rides/{rideId} {
  "type": "request",
  "driverId": "uid_driver",
  "targetUserIds": ["uid_driver", "uid_optional"],
  "from": "Gulshan",
  "to": "FAST",
  "requesterName": "Asad Ali",
  "notificationSent": false
}
```

## Setup
1. Copy `.env.example` to `.env`.
2. Put your service account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Install + start:

```bash
npm install
npm start
```

## Deploy free tier host
- Render/Railway/Fly with always-on worker or web service.
- Use `/health` endpoint for uptime checks.

## Test endpoint
`POST /send-test`

Headers:
- `x-worker-key: <WORKER_API_KEY>` (if configured)

Body:
```json
{
  "userIds": ["uid1"],
  "title": "Test",
  "body": "Hello",
  "link": "/dashboard/notifications",
  "data": { "type": "test" }
}
```
