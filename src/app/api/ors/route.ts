
// src/app/api/ors/route.ts
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Try both server-side and public env names to support different local setups
  const ORS_API_KEY = process.env.ORS_API_KEY || process.env.NEXT_PUBLIC_ORS_API_KEY;
  const ORS_KEY_SOURCE = process.env.ORS_API_KEY ? 'ORS_API_KEY' : (process.env.NEXT_PUBLIC_ORS_API_KEY ? 'NEXT_PUBLIC_ORS_API_KEY' : null);
  if (!ORS_API_KEY) {
    console.error('ORS API key missing. Set ORS_API_KEY or NEXT_PUBLIC_ORS_API_KEY in environment.');
    return NextResponse.json({ error: 'ORS API key is not configured.' }, { status: 500 });
  }
  // NOTE: Do not log the key value; log which env var provided it for debugging
  console.log('ORS proxy using key from env:', ORS_KEY_SOURCE);

  try {
    let body: any = null;
    try {
      body = await req.json(); // The coordinates from the client
    } catch (parseErr) {
      console.error('ORS proxy: failed to parse request JSON', parseErr);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Log incoming body for debugging (trim large payloads)
    try { console.log('ORS proxy incoming body:', JSON.stringify(body).slice(0, 2000)); } catch (_) {}

    // Basic request validation to avoid sending malformed requests to ORS
    if (!body || !Array.isArray(body.coordinates) || body.coordinates.length < 2) {
      return NextResponse.json({ error: 'Invalid request body. Expected { coordinates: [[lng, lat],[lng, lat]] }' }, { status: 400 });
    }

    const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    const maxAttempts = 2; // Reduced from 3 to 2 for faster failure feedback
    const baseTimeoutMs = 15000; // 15s base timeout - ORS typically responds in 6-10s
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutMs = attempt === 1 ? baseTimeoutMs : baseTimeoutMs + 5000; // 15s, then 20s
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
          let bodyText: string | null = null;
          try { bodyText = await response.text().catch(() => null); } catch (e) { bodyText = null; }
          try { errorBody = bodyText ? JSON.parse(bodyText) : null; } catch (e) { errorBody = bodyText; }

          // Build a compact headers snapshot
          let hdrs: Record<string, string> = {};
          try {
            if (response.headers && typeof response.headers.entries === 'function') {
              for (const [k, v] of Array.from(response.headers.entries()).slice(0, 6)) hdrs[k] = v;
            }
          } catch (e) { /* ignore */ }

          console.error('ORS API Error', { status: response.status, statusText: response.statusText, attempt, body: errorBody ?? bodyText, headers: hdrs });

          // Retry on server errors
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 200 * attempt)); // Faster backoff: 200ms, 400ms
            continue;
          }

          // Prepare details for client: prefer structured body, otherwise provide text/status
          const detailsForClient = (errorBody && typeof errorBody === 'object' && Object.keys(errorBody).length === 0)
            ? { message: 'Empty upstream JSON body', statusText: response.statusText || null, headers: hdrs }
            : (errorBody ?? bodyText ?? null);

          return NextResponse.json({ error: 'ORS upstream error', status: response.status, statusText: response.statusText, details: detailsForClient }, { status: response.status });
        }

        const routeData = await response.json();
        return NextResponse.json(routeData);
      } catch (err: any) {
        clearTimeout(timer);
        lastErr = err;
        const isTimeout = err?.name === 'AbortError' || err?.code === 'UND_ERR_CONNECT_TIMEOUT' || String(err?.message).toLowerCase().includes('timeout');
        console.warn('ORS proxy fetch failed', { attempt, isTimeout, message: err?.message, code: err?.code });

        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 200 * attempt)); // Faster retry backoff: 200ms, 400ms
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
