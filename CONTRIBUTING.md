# Contributing to Campus Rides

This guide defines the required workflow for all contributors.

## Golden Rules

- Never push directly to `main`.
- Never push directly to `dev`.
- Every change must go through a Pull Request (PR).
- Every PR must be reviewed before merge.

## Branch Architecture

| Branch | Purpose | Who pushes directly? |
| --- | --- | --- |
| `main` | Production releases only | Release maintainers only (via PR merge) |
| `dev` | Integration and QA branch | Maintainers only (via PR merge) |
| `feature/*` | Feature development | Contributors |
| `fix/*` | Bug fixes | Contributors |
| `docs/*` | Documentation work | Contributors |

Examples:

- `feature-login`
- `feature-chat`
- `fix-booking-cancel`
- `docs-architecture-update`

## End-to-End Git Workflow

### 1) Clone the repository

```bash
git clone https://github.com/Saad140606/Campus-Rides.git
cd Campus-Rides
```

### 2) Install dependencies

```bash
npm install
```

### 3) Switch to latest `dev`

```bash
git fetch origin
git checkout dev
git pull origin dev
```

### 4) Create a feature branch

Use `feature-*` naming for product work:

```bash
git checkout -b feature-login
```

More examples:

- `feature-chat`
- `feature-ride-matching`
- `feature-admin-reports`

### 5) Develop and validate locally

```bash
npm run dev
npm run lint
npm run typecheck
```

### 6) Add and commit

```bash
git add .
git commit -m "feat(auth): add university login flow"
```

### 7) Push your branch

```bash
git push -u origin feature-login
```

### 8) Open PR to `dev`

- Source: `feature-login`
- Target: `dev`
- Include issue reference and testing notes.

PR title example:

```text
[feat][#101] Add university login flow
```

### 9) Address review comments

```bash
git add .
git commit -m "fix(auth): address login validation feedback"
git push
```

### 10) Merge `dev` -> `main` (release workflow)

Performed by maintainers after QA:

```bash
git checkout main
git pull origin main
git checkout dev
git pull origin dev

# open PR from dev to main in GitHub
# after approval, merge PR
```

### 11) Deploy

- `feature/*` -> Vercel Preview
- `dev` -> Staging deployment
- `main` -> Production deployment

Backend deployment when needed:

```bash
firebase deploy --only firestore:rules,storage:rules,functions
```

## Commit Message Convention

Use one of these prefixes:

- `feat`: new feature
- `fix`: bug fix
- `ui`: visual/UI changes
- `refactor`: structural improvement without behavior change
- `docs`: documentation changes

Format:

```text
<type>(<scope>): <short summary>
```

Examples:

- `feat(rides): add stop generation endpoint`
- `fix(api): prevent duplicate booking updates`
- `ui(dashboard): improve cards spacing and contrast`
- `refactor(notifications): isolate token service`
- `docs(contributing): add release checklist`

## Code Review Checklist

Reviewers should verify:

- Bugs: edge cases, null states, retries, race conditions.
- Logic: business rules are correct (booking, cancellation, lifecycle).
- Security: no secrets committed, auth checks are server-side, least privilege.
- Readability: maintainable naming, small functions, clear file boundaries.
- API behavior: status codes, input validation, error handling.
- Data impact: Firestore writes/reads are correct and cost-aware.
- Tests/manual checks: contributor provided verification notes.

## Task Management with GitHub Issues

All development should map to an issue.

### Issue naming examples

- `#101 feat: add FAST login onboarding`
- `#118 fix: booking request duplicates on retry`
- `#127 ui: redesign my-rides cards`
- `#133 docs: architecture onboarding for contributors`

### Recommended issue template

```text
Title: feat: add ride lifecycle auto-complete

Problem:
Current rides may remain active after completion.

Scope:
- Add lifecycle transition endpoint update
- Update UI state badges
- Add admin visibility

Acceptance Criteria:
- Ride transitions to completed state
- Notification is generated
- Dashboard reflects final state
```

### Linking issue to branch and PR

- Branch: `feature-133-ride-lifecycle`
- PR title: `[feat][#133] Add ride lifecycle auto-complete`
- PR description: include `Closes #133`

## Pull Request Requirements

Each PR to `dev` must include:

- Clear summary of changes.
- Linked issue(s).
- Risk notes (data migration, auth rules, API behavior).
- Screenshots/video for UI changes.
- Validation notes (`lint`, `typecheck`, manual flow tested).

## Security and Secrets Rules

- Do not commit `.env.local` or any real secret.
- Store runtime secrets in deployment environment settings.
- Use `FIREBASE_SERVICE_ACCOUNT_JSON` securely in server contexts only.
- Validate authorization in API handlers and/or Cloud Functions.

## Quick Command Reference

```bash
# sync local dev
git checkout dev
git pull origin dev

# create branch
git checkout -b feature-chat

# standard validation
npm run lint
npm run typecheck

# commit and push
git add .
git commit -m "feat(chat): add chat thread filters"
git push -u origin feature-chat
```

Thank you for contributing. 