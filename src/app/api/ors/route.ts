
// src/app/api/ors/route.ts
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!ORS_API_KEY) {
    return NextResponse.json({ error: 'ORS API key is not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json(); // The coordinates from the client

    // Basic request validation to avoid sending malformed requests to ORS
    if (!body || !Array.isArray(body.coordinates) || body.coordinates.length < 2) {
      return NextResponse.json({ error: 'Invalid request body. Expected { coordinates: [[lng, lat],[lng, lat]] }' }, { status: 400 });
    }

    const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    const maxAttempts = 3;
    const baseTimeoutMs = 10000; // base timeout per attempt
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutMs = baseTimeoutMs * attempt; // increase timeout each attempt
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': ORS_API_KEY,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          // Try to parse JSON error body, otherwise fall back to text
          let errorBody: any = null;
          try { errorBody = await response.json(); } catch (e) { errorBody = await response.text().catch(() => null); }

          console.error('ORS API Error', { status: response.status, attempt, body: typeof errorBody === 'string' ? errorBody.slice(0, 1000) : errorBody });

          // Retry on server errors
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 500 * attempt));
            continue;
          }

          return NextResponse.json({ error: 'ORS upstream error', status: response.status, details: errorBody }, { status: response.status });
        }

        const routeData = await response.json();
        return NextResponse.json(routeData);
      } catch (err: any) {
        clearTimeout(timer);
        lastErr = err;
        const isTimeout = err?.name === 'AbortError' || err?.code === 'UND_ERR_CONNECT_TIMEOUT' || String(err?.message).toLowerCase().includes('timeout');
        console.warn('ORS proxy fetch failed', { attempt, isTimeout, message: err?.message, code: err?.code });

        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }

        // Final failure after retries — return a 502 with a helpful message
        const message = isTimeout ? 'Timeout when connecting to ORS upstream' : 'Could not connect to ORS upstream';
        return NextResponse.json({ error: message, cause: String(err?.message || err), code: err?.code || null }, { status: 502 });
      }
    }

    // Shouldn't reach here, but fail closed
    return NextResponse.json({ error: 'Failed to fetch route from ORS' }, { status: 502 });

  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
