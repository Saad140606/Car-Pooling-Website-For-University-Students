# Firestore rules & local testing

✅ **What I added**
- `firestore.rules` — production-safe rules that:
  - Restrict reading/listing `universities/{id}/rides` to authenticated users whose `users/{uid}.university` equals that `id`.
  - Prevent listing (and block reads) when `users/{uid}` is missing (this avoids ambiguous permission-denied behavior).
  - Enforce `createdBy == request.auth.uid` on ride creation and restrict updates/deletes to the creator.
  - Provide chat/message rules so only ride participants can read/write messages.
- `firebase.json` & `.firebaserc` — emulator config for Firestore and Auth.

💡 **Why these rules**
- Security first: the rules ensure only authenticated users can access data, and they enforce *scoped access* to each university's data. This prevents cross-university data leakage.
- Deterministic failures: requiring the `users/{uid}` doc to exist reduces confusing `permission-denied` errors by failing earlier and with a clear cause.
- Chat safety: messages can only be read/written by chat participants and message writes must be sent by the authenticated user (senderId must match `request.auth.uid`).

---

## Quick local test steps
1. Install the Firebase CLI if needed: `npm install -g firebase-tools` (or use `npx firebase`).
2. Start emulators (Firestore + Auth + UI):

```bash
npx firebase emulators:start --only firestore,auth
```

3. Open the Emulator UI (usually `http://localhost:4000`) and create a test user.
4. In the Firestore emulator, create the user document `users/{uid}` with `university: "fast"` or run the app and sign in — the app now creates the user doc automatically on first sign-in.
5. Try listing `universities/fast/rides` in the app; it should succeed for users whose `users/{uid].university == 'fast'` and fail otherwise.

---

## Troubleshooting & hints
- If you see `FirestoreError: Missing or insufficient permissions` when listing rides, check:
  - Does `users/{uid}` exist for the signed-in user? The rule requires it.
  - Is `users/{uid}.university` set correctly? It must match the requested university id.
  - Use the Firestore Emulator to iterate quickly without touching production data.
- The client `useCollection` and `useDoc` hooks now emit `FirestorePermissionError` with a hint pointing to this doc.

---

## Want me to test it here?
I can start the emulator and run an end-to-end check: create a test user, verify `users/{uid}` creation, create a test ride, and confirm the read/list/write rules behave as expected. Reply **Yes** and I'll begin the emulation & verification run.