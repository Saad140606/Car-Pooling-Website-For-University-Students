import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing lat or lon' }, { status: 400 });
    }

    // Nominatim requires a valid User-Agent or Referer; set a sensible header.
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CampusRide/1.0 (dev@yourdomain.example)',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      console.error('Nominatim reverse error', { status: res.status, body: text });
      return NextResponse.json({ error: 'Nominatim error', status: res.status, details: text }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Nominatim reverse proxy failed', err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}