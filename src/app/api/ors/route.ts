// src/app/api/ors/route.ts
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!ORS_API_KEY) {
    return NextResponse.json({ error: 'ORS API key is not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json(); // The coordinates from the client
    
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ORS_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ORS API Error:", errorBody);
      return NextResponse.json({ error: `Failed to fetch route. Status: ${response.status}` }, { status: response.status });
    }

    const routeData = await response.json();
    return NextResponse.json(routeData);

  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
