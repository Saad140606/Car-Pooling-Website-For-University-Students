# Campus Rides

Campus Rides is a university-focused carpooling platform built with Next.js and Firebase. It helps students share rides safely within their campus network, with features like ride creation, booking requests, notifications, analytics, reporting, and admin moderation.

## Vision

- Build the most trusted student carpooling network for universities.
- Reduce commute costs and increase ride safety with identity-linked accounts.
- Provide a scalable base for multi-university and mobile-first expansion.

## Core Features

- University-based authentication and profile verification.
- Ride posting and discovery with route/stops support.
- Booking request lifecycle (request, accept/reject, confirm, cancel).
- Notification system (in-app and push support).
- Post-ride lifecycle workflows (completion and rating flows).
- Admin dashboard for users, rides, reports, messages, and analytics.
- Contact/report flows and moderation tooling.

## Planned Features

- AI-assisted ride matching and smart ride recommendations.
- Live location sharing and richer live tracking.
- Expanded in-app chat and calling enhancements.
- Better monetization and premium feature bundles.
- Native mobile app (Android/iOS) with deep-link support.
- Multi-university onboarding automation and tenant tooling.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 18, TypeScript |
| Styling/UI | Tailwind CSS, Radix UI, Framer Motion |
| Backend | Firebase Auth, Firestore, Firebase Storage, Cloud Functions |
| Analytics | Vercel Analytics, custom analytics APIs |
| Notifications | Firebase Cloud Messaging + optional Spark push worker |
| AI/Automation | Genkit (optional development flows) |

## Project Structure

```text
.
|- src/
|  |- app/                # Next.js routes (UI pages + API route handlers)
|  |- components/         # Shared UI and domain components
|  |- firebase/           # Firebase client/admin initialization and helpers
|  |- hooks/              # React hooks for app behavior and data safety
|  |- lib/                # Domain services, business logic, utility helpers
|  |- contexts/           # React context providers
|  |- config/             # App and SEO config
|  |- ai/                 # Genkit integration
|  `- types/              # Shared TypeScript types
|- functions/             # Firebase Cloud Functions project
|- spark-push-backend/    # External push worker for Spark plan
|- scripts/               # Admin, migration, and maintenance scripts
|- public/                # Static assets, PWA files, downloadable APK
|- docs/                  # Backend shape and integration docs
|- firestore.rules        # Firestore security rules
|- storage.rules          # Storage security rules
|- firebase.json          # Firebase project and emulator config
|- middleware.ts          # Security middleware + header hardening
`- ARCHITECTURE.md        # Detailed architecture documentation
```

For full architecture and folder-by-folder details, see `ARCHITECTURE.md`.

## Local Setup

### 1) Clone and install

```bash
git clone https://github.com/Saad140606/Campus-Rides.git
cd Campus-Rides
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 3) Run local development

```bash
npm run dev
```

Default app URL: `http://localhost:9002`

## Environment Variables

Main app uses `NEXT_PUBLIC_*` Firebase values and selected server-side values for secure operations.

Minimum required keys:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ORS_API_KEY`

Optional server-side keys:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `WORKER_API_KEY` (for external push worker)

## Branch Structure

| Branch | Purpose |
| --- | --- |
| `main` | Production-ready stable code |
| `dev` | Integration branch for tested feature PRs |
| `feature/*` | Feature/task-specific branches (`feature-login`, `feature-chat`) |
| `fix/*` | Bugfix branches (`fix-ride-cancel`) |

## Git Workflow (Required)

Never push directly to `main` or `dev`.

```bash
# one-time
git clone <your-fork-or-org-repo-url>
cd Car-Pooling-Website-For-University-Students

# always start from latest dev
git fetch origin
git checkout dev
git pull origin dev

# create your feature branch
git checkout -b feature-login

# code changes
git add .
git commit -m "feat(auth): add university login page"
git push -u origin feature-login

# open PR: feature-login -> dev
# after approval and merge, keep local branches fresh
git checkout dev
git pull origin dev
```

Release flow:

1. `feature/*` PR into `dev`.
2. QA/regression validation on `dev`.
3. `dev` PR into `main`.
4. Production deployment from `main`.

## Coding Standards

- Use TypeScript strict patterns and keep type safety in service modules.
- Prefer reusable components and hooks over duplicated logic.
- Validate API inputs and enforce authorization checks server-side.
- Keep files focused: route handlers coordinate, `lib/` contains business logic.
- Add or update documentation for any non-trivial architectural change.

### Commit Message Format

Use the following prefixes:

- `feat:` new feature
- `fix:` bug fix
- `ui:` visual/UI updates
- `refactor:` structural code changes without behavior change
- `docs:` documentation updates

Examples:

- `feat(rides): add stop generation endpoint`
- `fix(auth): prevent stale session reuse`
- `ui(dashboard): improve ride card spacing`
- `refactor(notifications): split token manager service`
- `docs(architecture): add lifecycle flow notes`

## Task Management

Use GitHub Issues and Projects for planning and traceability.

Issue naming examples:

- `#101 feat: add FAST university onboarding flow`
- `#118 fix: duplicate booking request on retry`
- `#132 ui: improve admin reports filters`

Branch naming tied to issue:

- `feature-101-onboarding-fast`
- `fix-118-booking-retry`

PR title examples:

- `[feat][#101] Add FAST onboarding flow`
- `[fix][#118] Prevent duplicate booking request`

## Deployment Overview

Typical Vercel deployment model:

| Git branch | Deployment type |
| --- | --- |
| `feature/*` | Preview deployment |
| `dev` | Shared staging deployment |
| `main` | Production deployment |

Additional backend deployment:

- `firebase deploy --only firestore:rules,storage:rules,functions`
- Deploy worker service from `spark-push-backend/` when Spark push backend is enabled.

## Contribution Summary

1. Pick a GitHub Issue.
2. Branch from `dev` (`feature-*` or `fix-*`).
3. Build, test, and self-review.
4. Open PR to `dev` with issue link and checklist.
5. After review and merge, validate staging.
6. Release via PR from `dev` to `main`.

Read `CONTRIBUTING.md` for complete command-by-command contribution guidance.
