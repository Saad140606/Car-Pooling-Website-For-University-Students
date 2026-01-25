'use client';

import dynamic from 'next/dynamic';
// Defensive patch: wrap Leaflet's Map.remove to ignore benign "being reused" errors
if (typeof window !== 'undefined') {
  try {
    // Import Leaflet asynchronously to avoid SSR issues
    import('leaflet').then((L) => {
      try {
        // UI-matching pin (primary accent with subtle stroke)
        const pinSvg = `
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 36'>
            <defs>
              <filter id='shadow' x='-50%' y='-50%' width='200%' height='200%'>
                <feGaussianBlur stdDeviation='1.2' />
              </filter>
            </defs>
            <path d='M12 2C8 2 5 5 5 9c0 6 7 25 7 25s7-19 7-25c0-4-3-7-7-7z' fill='%235B9BFF' stroke='%23ffffff' stroke-width='1.4' />
            <circle cx='12' cy='10' r='3.3' fill='%230b1220' />
          </svg>
        `;
        const pinDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg)}`;
        try {
          (L as any).Icon.Default.mergeOptions({
            iconRetinaUrl: pinDataUrl,
            iconUrl: pinDataUrl,
            shadowUrl: '',
            // Ensure stable positioning across zoom levels
            iconSize: [24, 36],
            iconAnchor: [12, 36],
            popupAnchor: [0, -32],
          });
        } catch (e) {
          // ignore merge failure in unusual build environments
        }
        // Remove DOM mutation hack; the proper icon options above keep anchors stable.
      } catch (_) {}
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
