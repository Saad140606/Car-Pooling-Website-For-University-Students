'use client';

import dynamic from 'next/dynamic';
// ── PERF: Import Leaflet CSS only when map components are actually used ──
import 'leaflet/dist/leaflet.css';

// Defensive patch: wrap Leaflet's Map.remove to ignore benign "being reused" errors
if (typeof window !== 'undefined') {
  try {
    // Import Leaflet asynchronously to avoid SSR issues
    import('leaflet').then((L) => {
      try {
        const createCustomPin = (color: string = '#E84C3D') => `
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 48'>
            <defs>
              <filter id='shadow' x='-50%' y='-50%' width='200%' height='200%'>
                <feDropShadow dx='0' dy='3' stdDeviation='3' flood-opacity='0.35' />
              </filter>
              <linearGradient id='grad' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style='stop-color:${color};stop-opacity:1' />
                <stop offset='100%' style='stop-color:${adjustColor(color, -28)};stop-opacity:1' />
              </linearGradient>
            </defs>
            <path d='M16 2C9.9 2 5 6.9 5 13c0 10 11 33 11 33s11-23 11-33c0-6.1-4.9-11-11-11z' 
              fill='url(#grad)' stroke='#ffffff' stroke-width='1.5' filter='url(#shadow)' />
            <circle cx='16' cy='14' r='5.2' fill='#ffffff' opacity='0.95' />
            <circle cx='16' cy='14' r='2.4' fill='${adjustColor(color, -34)}' opacity='0.9' />
          </svg>
        `;

        const pinDataUrl = (color?: string) => 
          `data:image/svg+xml;utf8,${encodeURIComponent(createCustomPin(color))}`;

        try {
          // Set default icon to red pin
          (L as any).Icon.Default.mergeOptions({
            iconRetinaUrl: pinDataUrl(),
            iconUrl: pinDataUrl(),
            shadowUrl: '',
            iconSize: [32, 48],
            iconAnchor: [16, 48],
            popupAnchor: [0, -42],
            tooltipAnchor: [16, -32],
          });
        } catch (e) {
          // ignore merge failure in unusual build environments
        }
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

// Export custom pin creator for use in components
export const createMapPin = (color: string = '#E84C3D') => {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 48'>
      <defs>
        <filter id='shadow' x='-50%' y='-50%' width='200%' height='200%'>
          <feDropShadow dx='0' dy='3' stdDeviation='3' flood-opacity='0.35' />
        </filter>
        <linearGradient id='grad' x1='0%' y1='0%' x2='0%' y2='100%'>
          <stop offset='0%' style='stop-color:${color};stop-opacity:1' />
          <stop offset='100%' style='stop-color:${adjustColor(color, -30)};stop-opacity:1' />
        </linearGradient>
      </defs>
      <path d='M16 2C9.9 2 5 6.9 5 13c0 10 11 33 11 33s11-23 11-33c0-6.1-4.9-11-11-11z' 
        fill='url(#grad)' stroke='#ffffff' stroke-width='1.5' filter='url(#shadow)' />
      <circle cx='16' cy='14' r='5.2' fill='#ffffff' opacity='0.95' />
      <circle cx='16' cy='14' r='2.4' fill='${adjustColor(color, -34)}' opacity='0.9' />
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Helper: adjust color brightness for gradient
function adjustColor(color: string, amount: number) {
  const usePound = color[0] === '#';
  const col = usePound ? color.slice(1) : color;
  const num = parseInt(col, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return (usePound ? '#' : '') + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

export const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { 
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-900/50"><div className="text-slate-400">Loading map...</div></div>
  }
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