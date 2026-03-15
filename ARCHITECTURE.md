# Campus Rides Architecture

This document explains how the Campus Rides system is organized so new developers, partners, and contributors can onboard quickly.

## 1. System Overview

Campus Rides is a multi-module web platform for university ride sharing.

- Frontend: Next.js App Router application (`src/app`) with reusable component architecture.
- Backend: Firebase Auth + Firestore + Storage + Cloud Functions.
- Notifications: In-app notifications plus push delivery (FCM), with optional Spark-plan worker.
- Deployment: Git-based deployments to Vercel and Firebase resources.

## 2. High-Level Architecture

```text
User Browser (Next.js UI)
   -> Next.js Route Handlers (/api/*)
   -> Firebase Auth (identity)
   -> Firestore (rides, bookings, users, chats, notifications)
   -> Firebase Storage (uploads/support)
   -> Cloud Functions (scheduled jobs, lifecycle maintenance, notification triggers)
   -> Optional Spark Push Worker (external service for FCM delivery)
```

## 3. Frontend Architecture (React + Next.js)

### 3.1 App Router structure

Core routing is under `src/app`.

- Public pages: home/about/how-it-works/contact/terms.
- Auth pages: university-specific login/register and reset flows.
- Dashboard pages: account, rides, bookings, notifications, analytics.
- Admin pages: admin login and dashboard modules.
- API handlers: all backend HTTP handlers in `src/app/api/**/route.ts`.

### 3.2 UI and domain components

Core shared UI is in `src/components`.

- Generic reusable components: cards, inputs, modals, tables, indicators.
- Domain groups:
  - `components/chat`: chat room and messaging UI.
  - `components/calling`: call/incoming/active call surfaces.
  - `components/analytics`: charts, cards, history tables.
  - `components/admin`: admin dashboard visual modules.
  - `components/ride-lifecycle`: lifecycle status UI.
  - `components/support`: contact/report forms.
  - `components/pwa`: install/service-worker integration.
  - `components/ui`: Radix + Tailwind primitives.

### 3.3 Services, hooks, and utilities

- `src/lib`: domain services (bookings, notifications, analytics, lifecycle, routing, verification).
- `src/hooks`: reusable state/effect hooks (online status, admin auth, ride lifecycle monitor).
- `src/contexts`: app-wide context providers (notifications, post-ride workflow, calling).
- `src/config`: central constants (SEO, lifecycle config).
- `src/types`: shared TS types.

## 4. Backend Architecture (Firebase + Server Logic)

### 4.1 Authentication

- Firebase Authentication for user identity.
- University-specific auth flows handled by route/pages and verification helpers.
- Admin access controlled via `admins/{uid}` documents and backend checks.

### 4.2 Firestore data model

Main structure:

```text
admins/{uid}
public_rides/{id}
contact_messages/{id}
reports/{id}
fcm_tokens/{uid}
users/{uid}                              # Spark worker token mirror / push fields
rides/{id}                               # Spark push request queue example
universities/{universityId}/
  users/{uid}
  rides/{rideId}
    requests/{requestId}
  bookings/{bookingId}
  chats/{chatId}
    messages/{messageId}
  notifications/{notificationId}
  lifecycle_ratings/{ratingId}
  user_rating_stats/{uid}
  rideCompletions/{rideId}
  unreadEvents/{eventDocId}
```

### 4.3 Cloud Functions

Cloud Functions project is under `functions/`.

- Scheduled jobs:
  - `expireRides`: marks past rides as expired.
  - `deleteExpiredRides`: deletes old expired rides and related data.
- Triggered maintenance:
  - Booking deletion cleanup for related chats/messages.
- Lifecycle exports:
  - `lifecycleLockRides`
  - `lifecycleCompletionManager`
  - `onRideLifecycleChange`

### 4.4 Optional Spark push backend

`spark-push-backend/` is an external Node worker used for Spark-plan deployments without full Cloud Functions dependence for certain push scenarios.

- Watches request documents.
- Reads user FCM tokens.
- Sends push notifications.
- Writes delivery status back to Firestore.

## 5. Repository Structure and Responsibilities

## 5.1 Top-level files and folders

| Path | Responsibility |
| --- | --- |
| `src/` | Main web application source code |
| `functions/` | Firebase Cloud Functions source + compiled output |
| `spark-push-backend/` | External push notification worker service |
| `scripts/` | Migration/admin/testing helper scripts |
| `public/` | Static assets, PWA files, APK artifact |
| `docs/` | Backend schema examples and integration docs |
| `patches/` | Dependency patch files (patch-package style) |
| `apphosting.yaml` | Hosting/runtime config for app hosting workflows |
| `firebase.json` | Firebase emulators and resource config |
| `firestore.rules` | Firestore authorization and validation rules |
| `firestore.indexes.json` | Firestore index definitions |
| `storage.rules` | Cloud Storage security rules |
| `middleware.ts` | Security headers and blocked-path middleware |
| `next.config.ts` | Next.js config, optimizations, env passthrough |
| `tailwind.config.ts` | Tailwind theme/build config |
| `postcss.config.mjs` | PostCSS pipeline config |
| `components.json` | UI component generator/config metadata |
| `tsconfig.json` | TypeScript compiler configuration |
| `package.json` | Web app dependencies and npm scripts |
| `.eslintrc.json` | Linting policy |
| `.firebaserc` | Firebase project alias config |
| `.gitignore` | Git ignore rules |
| `build.log` / `build_output.txt` | Build logs/artifacts for diagnostics |
| `README.md` | Main onboarding document |
| `CONTRIBUTING.md` | Contribution workflow and team rules |
| `ARCHITECTURE.md` | This architecture reference |

## 5.2 `src/` detailed architecture

### `src/ai`

- `dev.ts`: local AI development entry.
- `genkit.ts`: Genkit configuration and integration.

### `src/app` (routes + API)

Global route files:

- `globals.css`: global styles.
- `layout.tsx`: root layout.
- `page.tsx`: landing page.
- `robots.ts`: robots configuration.
- `sitemap.ts`: sitemap configuration.

Public route groups:

- `about/`, `contact-us/`, `how-it-works/`, `terms/`, `report/`, `rides/`, `unauthorized/`, `debug/`.

Authentication route groups:

- `auth/select-university`
- `auth/fast/login`, `auth/fast/register`
- `auth/ned/login`, `auth/ned/register`
- `auth/karachi/login`, `auth/karachi/register`
- `auth/forgot-password`
- `auth/reset-password/verify-code`
- `auth/reset-password/set-password`
- `auth/verify-email`

Dashboard route groups:

- `dashboard/account`
- `dashboard/analytics`
- `dashboard/complete-profile`
- `dashboard/create-ride`
- `dashboard/rides` (+ `filters`)
- `dashboard/my-rides`
- `dashboard/my-bookings`
- `dashboard/notifications`
- `dashboard/contact`
- `dashboard/report`

Admin route groups:

- `admin-login`
- `admin-dashboard`
- `admin-dashboard/analytics`
- `admin-dashboard/bookings`
- `admin-dashboard/messages`
- `admin-dashboard/reports`
- `admin-dashboard/rides`
- `admin-dashboard/users`

API route handlers under `src/app/api`:

- Auth/session/email APIs: `check-email-available`, `send-signup-otp`, `verify-signup-email`, `send-verification-email`, `verify-university-email`, `session`, password reset routes.
- Rides/bookings/requests APIs: `rides/*`, `bookings/*`, `requests/*`, `public-rides`.
- Lifecycle/rating APIs: `ride-lifecycle/*`, `rating/*`.
- Notifications/contact/feedback: `notifications/*`, `contact`, `feedback/*`.
- Geocoding/routing helpers: `nominatim/*`, `ors`.
- Admin APIs: `admin/*` (analytics, approvals, reports, users, rides, messages, auth verification).

### `src/components`

Root component files provide shared cross-feature UI blocks (cards, dialogs, map, guards, toasts, selectors).

Subfolders:

- `components/admin`: admin charts/widgets.
- `components/analytics`: analytics panels and chart wrappers.
- `components/animations`: animation exports.
- `components/auth`: auth form abstraction.
- `components/calling`: WebRTC call surfaces and handlers.
- `components/chat`: chat room and message pipeline UI.
- `components/email`: transactional email templates.
- `components/feedback`: feedback prompt manager.
- `components/notifications`: notification enablement banners.
- `components/post-ride`: post-ride flow entry and rating popup.
- `components/premium`: premium feature UI actions.
- `components/pwa`: service worker and PWA install helpers.
- `components/ride-lifecycle`: ride lifecycle state visualization.
- `components/support`: support/report forms.
- `components/ui`: reusable design-system primitives.

### `src/config`

- `lifecycle.ts`: ride lifecycle constants/config values.
- `seo.ts`: SEO metadata helpers.

### `src/contexts`

- `ActivityIndicatorContext.tsx`
- `CallingContext.tsx`
- `NotificationContext.tsx`
- `PostRideWorkflowContext.tsx`
- `RideCompletionContext.tsx`

These provide app-wide state orchestration for async UX and domain workflows.

### `src/firebase`

Core integration layer for Firebase SDKs.

- Client setup: `config.ts`, `firebase.ts`, `init.ts`, `provider.tsx`, `client-provider.tsx`.
- Admin setup: `firebaseAdmin.ts`.
- Error/network helpers: `errors.ts`, `error-emitter.ts`, `networkStatus.ts`.
- Auth hooks: `auth/use-is-admin.tsx`, `auth/use-user.tsx`.
- Firestore helpers/hooks: chat, notifications, support, generic collection/doc hooks.
- Storage helpers: upload/support file helpers.

### `src/hooks`

Reusable hooks for:

- Admin auth/analytics,
- Network and retry behavior,
- Safe navigation and safe firestore reads,
- Ride lifecycle state and monitor,
- Notification manager and ringtone initialization.

### `src/lib`

Business logic modules for:

- Bookings and ride search/matching helpers.
- Notification routing and token management.
- Analytics and dashboard summarization.
- Ride cancellation/completion policies.
- Security helpers (API guards, account lock, session manager).
- Map/routing helpers and stop ordering/filtering.
- University verification and profile logic.
- Ride lifecycle state machine and transition services in `lib/rideLifecycle`.

### `src/types`

Domain type definitions and TS shims.

## 5.3 `functions/` detailed structure

| Path | Responsibility |
| --- | --- |
| `functions/src/index.ts` | Function exports, schedulers, cleanup, notification triggers |
| `functions/src/cleanupOnRide.ts` | Ride cleanup helper logic |
| `functions/src/rideLifecycleScheduler.ts` | Lifecycle scheduler handlers |
| `functions/lib/*.js` | Compiled JavaScript output from TypeScript sources |
| `functions/package.json` | Functions dependencies and deploy script |
| `functions/tsconfig.json` | TS config for functions build |

## 5.4 `scripts/` utilities

| Script | Responsibility |
| --- | --- |
| `add-admin.js` / `set-admin.js` | Manage admin users in Firestore |
| `backfill-chats.js` | Repair/backfill chat records |
| `cleanup-orphan-chats.js` | Remove orphan chat data |
| `migrate-createdBy.js` / `migrate-createdBy-rest.js` | Data migration for creator fields |
| `expire-rides.js` / `expire-rides-emulator-test.js` | Ride expiration testing/ops |
| `emulator-tests.js` | Emulator-level backend tests |
| `playwright-test-map.js` | Map interaction testing |
| `generate-icons.ps1` / `generate-icons.sh` | PWA/app icon generation |
| `verify-pwa.ps1` / `verify-pwa.sh` | PWA setup verification |

## 5.5 `public/` assets

- Static campus images.
- Map markers and map images.
- PWA files: `manifest.json`, `service-worker.js`, `firebase-messaging-sw.js`.
- Download bundle: `public/downloads/campus-rides.apk`.
- Sound placeholders: `public/sounds/`.

## 5.6 `docs/`

- `backend.json`: backend entities/schema reference.
- `stops-integration-examples.ts`: route-stop integration examples.

## 5.7 `spark-push-backend/`

| Path | Responsibility |
| --- | --- |
| `server.js` | Worker server for push delivery |
| `package.json` | Worker dependencies and startup command |
| `README.md` | Worker-specific setup and usage |
| `.env` | Worker local environment values |

## 6. End-to-End Data Flow

### Flow: login -> ride request -> matching -> notifications -> confirmation -> live tracking

1. Login
- User authenticates through Firebase Auth (email/password + university flow).
- User profile is read/written in university-scoped user collection.

2. Ride request
- Passenger creates request via dashboard UI.
- Request is written to ride request documents and/or booking structures.

3. Matching
- Server/API logic filters rides by university, route, seat availability, constraints.
- Candidate rides are returned and rendered in dashboard/cards.

4. Notifications
- In-app notification docs are created in Firestore.
- Push notification pipeline sends FCM events (Cloud Function or Spark worker path).

5. Confirmation
- Driver accepts/rejects request.
- Booking/request status updates in Firestore.
- UI receives state updates, and passenger sees final status.

6. Live tracking and lifecycle
- Ride lifecycle endpoints and state machine drive status progression.
- Tracking/status indicators are shown through lifecycle UI components and notifications.

## 7. Deployment Architecture

### 7.1 Vercel deployment flow

| Git branch | Deployment target | Typical purpose |
| --- | --- | --- |
| `feature/*` | Vercel Preview | Feature validation and review |
| `dev` | Staging | Integrated QA and testing |
| `main` | Production | Public release |

### 7.2 Backend deployment flow

- Firestore/Storage rules and Functions are deployed using Firebase CLI.

```bash
firebase deploy --only firestore:rules,storage:rules,functions
```

- Spark worker is deployed separately when used (Render/Railway/Fly or equivalent).

## 8. Branch Architecture and Merge Workflow

1. Create branch from `dev`.
2. Implement and validate changes.
3. Open PR from `feature/*` to `dev`.
4. Review and merge after approvals.
5. Stabilize and test `dev`.
6. Open PR from `dev` to `main` for release.
7. Deploy `main` to production.

Strict policy:

- No direct pushes to `main`.
- No direct pushes to `dev`.
- PR reviews are mandatory.

## 9. Security Practices

- Secrets are stored in environment configuration, never committed.
- Firestore rules enforce role and ownership-based access.
- Admin authorization is based on `admins/{uid}` documents.
- API handlers perform server-side authorization checks.
- Middleware adds HTTP security headers and blocks suspicious paths.
- Sensitive operations prefer server-managed paths over client-only checks.
- Code reviews must include security checks before merge.

## 10. Future Enhancements Roadmap

- AI ride matching and recommendation ranking.
- Full real-time live tracking with improved map telemetry.
- Enhanced chat and in-call experiences.
- Multi-university tenant management and onboarding automation.
- Native mobile applications with push-first UX.
- Expanded analytics for ride quality, safety, and trust scoring.

## 11. Developer Onboarding Checklist

1. Read `README.md` and `CONTRIBUTING.md`.
2. Configure `.env.local` from `.env.example`.
3. Run local app and validate auth + dashboard flow.
4. Understand route handlers in `src/app/api` for your feature area.
5. Follow `feature/* -> dev -> main` workflow for all changes.