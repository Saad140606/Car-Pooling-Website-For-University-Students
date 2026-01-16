import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';

// GET /api/public-rides?uni=all|ned|fast&limit=10&pageToken=TIMESTAMP
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const uni = (url.searchParams.get('uni') || 'all').toLowerCase();
    const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit') || '10')));
    const pageToken = url.searchParams.get('pageToken'); // ISO or ms

    const db = admin.firestore();

    const universities = uni === 'all' ? ['ned', 'fast'] : [uni];

    const promises = universities.map(async (u) => {
      const col = db.collection('universities').doc(u).collection('rides');
      let q = col.orderBy('departureTime', 'asc').limit(limit);
      if (pageToken) {
        // Interpret pageToken as milliseconds
        const t = Number(pageToken);
        if (!isNaN(t)) q = col.where('departureTime', '>', admin.firestore.Timestamp.fromMillis(t)).orderBy('departureTime', 'asc').limit(limit);
      }
      const snap = await q.get();
      const docs = snap.docs.map(d => ({ id: d.id, data: d.data(), university: u }));
      return docs;
    });

    const perUni = await Promise.all(promises);
    // Flatten and sort by departureTime
    const merged = perUni.flat().map(item => {
      const dt = item.data.departureTime;
      const ts = dt && dt._seconds ? (dt._seconds * 1000) : (typeof dt === 'number' ? dt : null);
      return { id: item.id, university: item.university, raw: item.data, departureMs: ts };
    }).filter(r => r.departureMs != null);

    merged.sort((a, b) => a.departureMs - b.departureMs);

    const sliced = merged.slice(0, limit);

    // Sanitize each ride
    const sanitized = sliced.map(r => {
      const d = r.raw as any;
      // pickup/drop area: attempt to use display names from waypoints or from/to fields truncated
      const pickupArea = (typeof d.from === 'string') ? d.from.split(',').slice(0,2).join(',') : '';
      const dropArea = (typeof d.to === 'string') ? d.to.split(',').slice(0,2).join(',') : '';
      const stops = Array.isArray(d.stops) ? d.stops.map((s:any) => (s.name ? s.name : (s.lat && s.lng ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : null))).filter(Boolean) : [];

      return {
        id: r.id,
        university: r.university,
        fromArea: pickupArea,
        toArea: dropArea,
        departureTime: new Date(r.departureMs).toISOString(),
        seatsLeft: d.availableSeats ?? d.totalSeats ?? null,
        price: d.price ?? null,
        transportMode: d.transportMode ?? d.transport ?? 'car',
        genderAllowed: d.genderAllowed ?? 'both',
        stops: stops.slice(0, 6),
      };
    });

    // nextPageToken: use departureMs of last item
    const nextToken = sliced.length ? String(sliced[sliced.length - 1].departureMs) : null;

    return NextResponse.json({ rides: sanitized, nextPageToken: nextToken });
  } catch (e: any) {
    console.error('public-rides error', e);
    return new NextResponse(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
