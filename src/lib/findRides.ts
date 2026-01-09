import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { decodePolyline, isPointNearPolyline } from './route';

export async function findRidesNearPoint(db: Firestore, university: string, point: { lat: number; lng: number }, thresholdMeters = 500) {
  // Prefilter using stored routeBounds (minLat,maxLat,minLng,maxLng). This reduces candidates.
  const ridesCol = collection(db, `universities/${university}/rides`);
  const q = query(
    ridesCol,
    where('status', '==', 'active'),
    where('routeBounds.minLat', '<=', point.lat),
    where('routeBounds.maxLat', '>=', point.lat),
    where('routeBounds.minLng', '<=', point.lng),
    where('routeBounds.maxLng', '>=', point.lng),
  );

  const snap = await getDocs(q);
  const matched: any[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    // Ensure polyline exists
    if (!data?.routePolyline) continue;
    try {
      const route = decodePolyline(data.routePolyline);
      const ok = isPointNearPolyline(point, route, thresholdMeters);
      if (ok) matched.push({ id: doc.id, data });
    } catch (e) {
      // skip malformed routes
      continue;
    }
  }
  return matched;
}
