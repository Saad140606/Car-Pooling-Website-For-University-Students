# Next.js + Firestore (Realtime) Integration Tips

This project uses Next.js 15 (client components) and Firestore client SDK for realtime data.

Key patterns
- Keep Firestore listeners in client components or custom hooks (useCollection/useDoc/useChatMessages) — avoid starting listeners in server components.
- Use `onSnapshot` for realtime updates, `getDocs`/`getDoc` for one-off reads.
- Always handle permission errors gracefully (the project now emits `permission-error` events and shows a user toast with guidance).

Example: `useCollection` (already implemented)
```ts
const ridesQuery = query(collection(db, 'universities', universityId, 'rides'), orderBy('createdAt', 'desc'));
const { data: rides, loading, error } = useCollection(ridesQuery);

if (error) {
  // UI will be notified by global FirebaseErrorListener, but you can also show inline info
}
```

Example (subscribe once):
```ts
useEffect(() => {
  const q = query(collection(db, 'universities', universityId, 'rides'), where('createdBy', '==', uid));
  getDocs(q).then(snap => /* ... */).catch(err => /* handle */);
}, [db, universityId, uid]);
```

Compatibility notes
- Works with Turbopack and Next.js 15 client components — the hooks in `src/firebase/firestore` are `use client` and safe for usage inside client components.
- Use the Firestore emulator for local testing of rules and indexes.
