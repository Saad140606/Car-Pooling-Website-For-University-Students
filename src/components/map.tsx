'use client';

import dynamic from 'next/dynamic';
// Defensive patch: wrap Leaflet's Map.remove to ignore benign "being reused" errors
if (typeof window !== 'undefined') {
  try {
    // Import Leaflet asynchronously to avoid SSR issues
    import('leaflet').then((L) => {
      try {
        const proto: any = (L as any).Map && (L as any).Map.prototype;
        if (proto && !proto.__remove_patched) {
          const orig = proto.remove;
          proto.remove = function () {
            try {
              return orig.apply(this, arguments as any);
            } catch (e: any) {
              const msg = String(e?.message || e);
              if (msg.includes('being reused') || msg.includes('already initialized')) {
                // swallow this error which occurs when React Strict Mode causes rapid mount/unmount
                console.warn('Ignored Leaflet remove error:', msg);
                return;
              }
              throw e;
            }
          };
          proto.__remove_patched = true;
        }
      } catch (e) {
        // ignore
      }
    }).catch(() => {});
  } catch (_) {}
}

export const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

export const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

export const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

export const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);

export const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);

export const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
);

// Hooks must be imported directly (not via `next/dynamic`) because they are hooks and cannot be wrapped
// with a dynamic component; this file runs client-side (`'use client'`) so a direct re-export is safe.
export { useMap } from 'react-leaflet';
export { useMapEvents } from 'react-leaflet';
