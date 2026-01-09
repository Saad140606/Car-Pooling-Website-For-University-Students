import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    const viewbox = url.searchParams.get('viewbox');
    const limit = url.searchParams.get('limit') || '5';
    if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

    const params = new URLSearchParams({ q, format: 'json', limit, countrycodes: 'pk' });
    if (viewbox) params.set('viewbox', viewbox);
    // Nominatim usage policy asks for a valid User-Agent / Referer
    const nomUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'CampusRide/1.0 (dev@yourdomain.example)', 'Accept-Language': 'en' },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      console.error('Nominatim search error', { status: res.status, body: text });
      return NextResponse.json({ error: 'Nominatim error', status: res.status, details: text }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Nominatim search proxy failed', err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}