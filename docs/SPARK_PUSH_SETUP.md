# Firebase Spark Push Setup (No Cloud Functions)

This setup gives near real-time web push notifications on Spark plan by using an **external Node worker**.

## 1) Frontend token registration

### Added helper
- [src/lib/sparkPushClient.ts](src/lib/sparkPushClient.ts)

### Added bootstrap component
- [src/components/SparkPushBootstrap.tsx](src/components/SparkPushBootstrap.tsx)

Mount it once inside your authenticated app shell/provider tree:

```tsx
import { SparkPushBootstrap } from '@/components/SparkPushBootstrap';

<SparkPushBootstrap />
```

This writes:

```json
users/{uid} {
  "fcmToken": "...",
  "fcmTokenUpdatedAt": "timestamp",
  "pushEnabled": true
}
```

## 2) Service worker for background/closed-browser delivery

This project already has:
- [public/service-worker.js](public/service-worker.js)

It handles `push` and `notificationclick`, which is enough for FCM web push notifications when app tab is closed.

## 3) Backend worker (Spark compatible)

Added:
- [spark-push-backend/server.js](spark-push-backend/server.js)
- [spark-push-backend/package.json](spark-push-backend/package.json)
- [spark-push-backend/.env.example](spark-push-backend/.env.example)
- [spark-push-backend/README.md](spark-push-backend/README.md)

### Run locally

```bash
cd spark-push-backend
npm install
npm start
```

### Host for free tier
Deploy this worker to Render / Railway / Fly / any always-on free worker host.

## 4) Firestore structure

```json
users/{uid} {
  "fcmToken": "token"
}

rides/{rideId} {
  "type": "request",
  "targetUserIds": ["uid1", "uid2"],
  "driverId": "uid1",
  "from": "A",
  "to": "B",
  "notificationSent": false
}
```

## 5) Notification flow

1. Frontend creates new request in `rides`.
2. External worker watches `rides` for new request docs.
3. Worker gets recipient tokens from `users`.
4. Worker sends FCM multicast.
5. Browser receives push via service worker even if app tab is closed.

## Notes

- Spark plan supports FCM and Firestore; it blocks Cloud Functions deployment.
- This architecture avoids Cloud Functions entirely.
- For stronger reliability, run worker in `snapshot` mode on an always-on host.
