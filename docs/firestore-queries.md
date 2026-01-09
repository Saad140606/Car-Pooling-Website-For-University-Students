# Firestore Query Examples & Index Guidance

This document shows practical Firestore queries that match the security rules in `firestore.rules` and explains index behavior.

## Common queries

1) List all rides for a university (real-time)
```ts
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

const ridesQuery = query(
  collection(firestore, 'universities', universityId, 'rides'),
  orderBy('createdAt', 'desc')
);

onSnapshot(ridesQuery, (snapshot) => {
  const rides = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  // use rides
});
```

2) Filter rides by creator (e.g., list your own rides)
```ts
const myRidesQuery = query(
  collection(firestore, 'universities', universityId, 'rides'),
  where('createdBy', '==', myUid),
  orderBy('createdAt', 'desc')
);
```

3) Paginated listing (cursor-based)
```ts
const pageSize = 20;
let lastDoc = null; // from previous snapshot
const pageQuery = query(
  collection(firestore, 'universities', universityId, 'rides'),
  orderBy('createdAt', 'desc'),
  startAfter(lastDoc),
  limit(pageSize)
);
```

4) Booking lookups
```ts
const bookingsForRide = query(
  collection(firestore, 'universities', universityId, 'bookings'),
  where('rideId', '==', rideId),
  where('status', '==', 'pending')
);
```

## Index guidance
- Firestore will prompt you with a link in the error message if a query requires a composite index. **Do not guess indexes**; follow the link and create the index shown.
- Common fields that may require composite indexes:
  - `createdBy` and `createdAt` (when using `where('createdBy','==',...)` together with `orderBy('createdAt')`).
  - `rideId` and `status` (when filtering bookings).
- When you see an error like `The query requires an index`, click the link in the console or server response to auto-generate the correct index definition.

## Notes
- Ensure queries align with security rules (e.g., users must belong to the university to list `universities/{id}/rides`).
- Use the Emulator during development; index creation and rules testing are safe there.
