'use client';

import React, { useEffect, useRef } from 'react';
import L, { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapLeafletProps = {
  route?: LatLngExpression[];         // polyline positions
  markers?: LatLngExpression[];       // marker positions
  bounds?: LatLngBoundsExpression;    // optional bounds to fit
  center?: LatLngExpression;          // fallback center
  zoom?: number;                      // fallback zoom
  className?: string;
  style?: React.CSSProperties;
  // Optional: override the tile provider URL (useful for Mapbox/Carto/etc). Defaults to Carto Voyager for a detailed, clean basemap.
  tileUrl?: string;
  tileAttribution?: string;
  maxZoom?: number;
};

export default function MapLeaflet({
  route,
  markers,
  bounds,
  center,
  zoom = 16,
  className,
  style,
  tileUrl,
  tileAttribution,
  maxZoom,
}: MapLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polyRef = useRef<L.Polyline | null>(null);
  const polyOutlineRef = useRef<L.Polyline | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Fix default icon paths (idempotent)
  if (typeof window !== 'undefined') {
    try {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl: '/marker-icon.png',
        shadowUrl: '/marker-shadow.png',
      });
    } catch (e) {
      // non-fatal if require fails in some build configs
    }
  }

  // Initialize the Leaflet map exactly once per mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    // Defensive: remove any stale Leaflet marker from this element (prevents double-init)
    try { if ((el as any)._leaflet_id) delete (el as any)._leaflet_id; } catch (_) {}

    // Guard: if already initialized (shouldn't be for fresh mount), skip
    if (mapRef.current) return;

    let map: L.Map;
    try {
      // Do not force canvas renderer; prefer Leaflet's default (usually SVG)
      map = L.map(el, { attributionControl: true, zoomControl: true });
    } catch (err) {
      // If Leaflet throws on initialization, ensure stale marker is removed then rethrow
      try { if ((el as any)._leaflet_id) delete (el as any)._leaflet_id; } catch (_) {}
      throw err;
    }
    mapRef.current = map;

    // Add base layer (default: CARTO Dark Matter for a professional dark theme)
    const providerUrl = (typeof (map as any).__tileUrl === 'string' && (map as any).__tileUrl) || tileUrl || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const providerAttribution = tileAttribution || '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const baseLayer = L.tileLayer(providerUrl, {
      attribution: providerAttribution,
      maxZoom: maxZoom ?? 19,
      detectRetina: true,
      subdomains: 'abcd'
    }).addTo(map);

    // Ensure attribution control is visible on the map
    try { if (map.attributionControl) map.attributionControl.setPrefix(''); } catch (_) {}

    // Add a small scale control for distance reference
    try { L.control.scale({ imperial: false, maxWidth: 200 }).addTo(map); } catch (_) {}

    // Ensure the map invalidates its size after tiles load and when the container resizes
    try {
      // When the base tiles finish loading, sometimes Leaflet needs an explicit invalidateSize to render correctly
      baseLayer.on('load', () => { try { setTimeout(() => map.invalidateSize(), 50); } catch (_) {} });

      // Resize observer to handle container transforms (e.g., dialogs opening, layout changes)
      const ro = new ResizeObserver(() => { try { map.invalidateSize(); } catch (_) {} });
      if (el) ro.observe(el);

      // Also handle window resize events as a fallback
      const onWindowResize = () => { try { map.invalidateSize(); } catch (_) {} };
      window.addEventListener('resize', onWindowResize);

      // Cleanup observer & listener on unmount
      (map as any).__resizeObserver = ro;
      (map as any).__onWindowResize = onWindowResize;
    } catch (_) {}

    // Add initial route / polyline (outline + highlight for contrast)
    if (route && route.length) {
      // Use SVG renderer explicitly to avoid canvas draw errors on teardown in Strict Mode
      try {
        // Outline behind the visible route for better contrast over labels
        polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95, renderer: L.svg() }).addTo(map);
        polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5, renderer: L.svg() }).addTo(map);
      } catch (e) {
        // fallback to default if svg renderer isn't available
        polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95 }).addTo(map);
        polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5 }).addTo(map);
      }
    }

    // Add initial markers (use circle markers for consistent high-contrast icons)
    if (markers && markers.length) {
      markerLayerRef.current = L.layerGroup().addTo(map);
      markers.forEach((m: any) => {
        let latlng: [number, number] | null = null;
        let label: string | undefined;

        if (Array.isArray(m) && m.length >= 2) latlng = [Number(m[0]), Number(m[1])];
        else if (typeof m === 'object' && m !== null) {
          if (typeof m.lat === 'number' && typeof m.lng === 'number') {
            latlng = [m.lat, m.lng];
            label = m.label;
          }
        }

        if (latlng) {
          const marker = L.circleMarker(latlng as any, { radius: 7, color: '#0b1220', weight: 1, fillColor: '#FFD166', fillOpacity: 1, interactive: true });
          if (label) {
            try { marker.bindTooltip(label, { direction: 'top', permanent: false }); } catch (_) {}
          }
          markerLayerRef.current!.addLayer(marker);
        }
      });
    }

    // Fit view
    try {
      if (bounds) map.fitBounds(bounds);
      else if (route && route.length) map.fitBounds(L.latLngBounds(route));
      else if (center) map.setView(center, zoom);
      else map.setView([24.8607, 67.0011], zoom);

      // Small deferred invalidate to ensure tiles and internal panes are laid out correctly
      try { setTimeout(() => { try { map.invalidateSize(); } catch (_) {} }, 50); } catch (_) {}
    } catch (_) {}

    // Cleanup: remove layers and the map so future mounts are clean
    return () => {
      try {
        if (polyRef.current && map.hasLayer(polyRef.current)) {
          map.removeLayer(polyRef.current);
        }
      } catch (_) {}
      try {
        if (markerLayerRef.current && map.hasLayer(markerLayerRef.current)) {
          map.removeLayer(markerLayerRef.current);
        }
      } catch (_) {}

      try {
        // Disconnect ResizeObserver and remove window resize listener if present
        try {
          const ro = (map as any).__resizeObserver as ResizeObserver | undefined;
          if (ro && el) ro.disconnect();
        } catch (_) {}
        try {
          const onWindowResize = (map as any).__onWindowResize as ((e: Event) => void) | undefined;
          if (onWindowResize) window.removeEventListener('resize', onWindowResize);
        } catch (_) {}

        map.off();
        map.remove();
      } catch (_) {}

      try { if (el && (el as any)._leaflet_id) delete (el as any)._leaflet_id; } catch (_) {}
      mapRef.current = null;
      polyRef.current = null;
      markerLayerRef.current = null;
    };
    // Intentionally empty deps: initialize once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update polyline when `route` changes (mutate existing layers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (route && route.length) {
      if (polyOutlineRef.current && polyRef.current) {
        polyOutlineRef.current.setLatLngs(route);
        polyRef.current.setLatLngs(route);
      } else {
        try {
          polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95, renderer: L.svg() }).addTo(map);
          polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5, renderer: L.svg() }).addTo(map);
        } catch (e) {
          polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95 }).addTo(map);
          polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5 }).addTo(map);
        }
      }
      // Intentionally do NOT auto-fit or center the map here — keep user-controlled view
    } else {
      if (polyRef.current) { try { map.removeLayer(polyRef.current); } catch (_) {} polyRef.current = null; }
      if (polyOutlineRef.current) { try { map.removeLayer(polyOutlineRef.current); } catch (_) {} polyOutlineRef.current = null; }
    }
  }, [route]);

  // Update markers when `markers` changes (replace layer)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (!markerLayerRef.current) markerLayerRef.current = L.layerGroup().addTo(map);
      else markerLayerRef.current.clearLayers();

      // Normalize and add markers as circle markers for consistent high-contrast icons.
      if (markers && markers.length) {
        markers.forEach((m: any) => {
          let latlng: [number, number] | null = null;
          let label: string | undefined;

          // Array form [lat, lng]
          if (Array.isArray(m) && m.length >= 2) {
            latlng = [Number(m[0]), Number(m[1])];
          } else if (typeof m === 'object' && m !== null) {
            // Object with lat/lng keys
            if (typeof m.lat === 'number' && typeof m.lng === 'number') {
              latlng = [m.lat, m.lng];
              label = m.label;
            } else if (Array.isArray((m as any).coordinates) && (m as any).coordinates.length >= 2) {
              latlng = [Number((m as any).coordinates[1]), Number((m as any).coordinates[0])];
            }
          }

          if (latlng) {
            const marker = L.circleMarker(latlng as any, { radius: 7, color: '#0b1220', weight: 1, fillColor: '#FFD166', fillOpacity: 1 });
            if (label) {
              try { marker.bindTooltip(label, { direction: 'top', permanent: false }); } catch (_) {}
            }
            markerLayerRef.current!.addLayer(marker);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to render markers', e);
    }
  }, [markers]);

  // Update bounds if provided
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { if (bounds) map.fitBounds(bounds); } catch (_) {}
  }, [bounds]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', backgroundColor: '#0b1220', ...style }} />;
}
