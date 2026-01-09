Migration: Backfill `createdBy` for rides

Purpose
- Some older ride documents are missing the `createdBy` field which our security rules rely on.
- This migration sets `createdBy = driverId` for rides where `createdBy` is missing and `driverId` exists.

Files
- `scripts/migrate-createdBy.js` — Admin SDK migration (recommended for production)
- `scripts/migrate-createdBy-rest.js` — Emulator-friendly REST migration (can run without admin SDK)

Dry-run first (recommended)
- Emulator: Start the emulators and run:
  - `node scripts/migrate-createdBy-rest.js --univ fast` (dry-run shows what would change)

Run against emulator with writes
- `node scripts/migrate-createdBy-rest.js --univ fast --apply --owner`
- `--owner` uses an emulated admin header (emulator-only).

Run against production (Admin SDK)
1. Create a Google Cloud service account with Firestore admin permissions, download JSON key.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the JSON key path.
3. Run the admin script:
   - `node scripts/migrate-createdBy.js --apply`
4. The admin script supports `--univ <id>` to limit scope.

Notes & safety
- Always run a dry-run first and test on the emulator.
- Test on a small subset (`--univ fast`) before running on all universities.
- Keep backups or export a Firestore export before modifying production data.

If you'd like, I can prepare a one-off CLI command you can paste into a VM or Cloud Shell to run this migration in your production project (I will not run it without your explicit consent and credentials).