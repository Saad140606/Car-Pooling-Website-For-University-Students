# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

Admin setup
-----------

Admin accounts are managed separately from normal users. Do NOT store admin flags in `users/{uid}`.

Data model:
- Create a document at `admins/{adminUid}` for each admin account. The presence of that document grants admin access.

Recommended workflow:
- Create admin users with distinct email addresses (e.g. `admin@example.com`) and sign them in like normal users.
- Use the included helper script (service-account required) to create or remove `admins/{uid}` documents.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/set-admin.js <ADMIN_UID> <ADMIN_EMAIL>    # creates admins/<ADMIN_UID>
node scripts/set-admin.js <ADMIN_UID> remove          # deletes admins/<ADMIN_UID>
```

On Windows PowerShell use:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
node .\scripts\set-admin.js <ADMIN_UID> admin%40example.com
node .\scripts\set-admin.js <ADMIN_UID> remove
```

Security rules
--------------

This project enforces admin-only access server-side using Firestore rules that check for the presence of an `admins/{uid}` document. Do NOT put admin flags in `users/{uid}` documents.

- Admins are created/removed using the Admin SDK (the included `scripts/set-admin.js` uses a service account).
- Firestore rules (in `firestore.rules`) implement `isAdmin()` as `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` and prevent client writes to `admins/*`.

Deploy rules with:

```bash
firebase deploy --only firestore:rules
```

Best practices
--------------

- Use distinct admin email accounts separate from normal users.
- Manage `admins/{uid}` documents only via server-side tools or the Admin SDK.
- Keep all sensitive admin endpoints protected by Firestore rules and, when possible, verify actions server-side (Cloud Functions) rather than relying on client checks.
- Audit access and rotate service account keys used for admin scripts.
