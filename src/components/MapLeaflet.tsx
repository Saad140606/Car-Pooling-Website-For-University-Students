'use client';

import React, { useEffect, useRef } from 'react';
import L, { LatLngExpression, LatLngBoundsExpression } from 'leaflet';

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
  startEndPins?: boolean;             // when true, render start/end pins derived from the route
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
  startEndPins = true,
}: MapLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polyRef = useRef<L.Polyline | null>(null);
  const polyOutlineRef = useRef<L.Polyline | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  // Fix default icon paths (idempotent) and align marker visuals with create-ride map
  if (typeof window !== 'undefined') {
    try {
      const pinSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
          <path d='M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z' fill='%232b2f67' stroke='%23ffffff' stroke-width='1.2' />
          <circle cx='12' cy='9' r='2.5' fill='%23FFD166' />
        </svg>
      `;
      const pinDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg)}`;
      L.Icon.Default.mergeOptions({ iconRetinaUrl: pinDataUrl, iconUrl: pinDataUrl, shadowUrl: '' });
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

    // Add base layer (default: OpenStreetMap with fallback to Carto Voyager to avoid blank tiles)
    let providerUrl = (typeof (map as any).__tileUrl === 'string' && (map as any).__tileUrl) || tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const fallbackUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const providerAttribution = tileAttribution || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Tiles: Carto Voyager fallback';

    const baseLayer = L.tileLayer(providerUrl, {
      attribution: providerAttribution,
      maxZoom: maxZoom ?? 19,
      detectRetina: true,
      subdomains: 'abcd',
      crossOrigin: true,
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(map);

    baseLayer.on('tileerror', () => {
      // Switch to fallback provider if primary tiles fail (prevents gray squares)
      if (providerUrl !== fallbackUrl) {
        providerUrl = fallbackUrl;
        try { baseLayer.setUrl(fallbackUrl); } catch (_) {}
      }
    });

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
      console.log('[MAP] Drawing initial route with', route.length, 'points');
      // Use SVG renderer explicitly to avoid canvas draw errors on teardown in Strict Mode
      const mainColor = '#3b82f6'; // Vibrant blue
      const outlineColor = '#1e3a8a'; // Dark blue outline for depth
      try {
        // Draw outline for depth and contrast
        polyOutlineRef.current = L.polyline(route, { color: outlineColor, weight: 10, opacity: 0.8, renderer: L.svg() }).addTo(map);
        // Draw main route with gradient-like effect
        polyRef.current = L.polyline(route, { color: mainColor, weight: 6, opacity: 0.95, renderer: L.svg(), lineCap: 'round', lineJoin: 'round' }).addTo(map);
        console.log('[MAP] ✓ Route polyline rendered successfully');
      } catch (e) {
        console.warn('[MAP] SVG renderer failed, using fallback:', e);
        // fallback to default if svg renderer isn't available
        polyOutlineRef.current = L.polyline(route, { color: outlineColor, weight: 10, opacity: 0.8 }).addTo(map);
        polyRef.current = L.polyline(route, { color: mainColor, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      }
    } else {
      console.log('[MAP] No route data to draw');
    }

    // Add initial markers (pickup pins) plus optional start/end pins
    markerLayerRef.current = L.layerGroup().addTo(map);

    const pickupIcon = L.divIcon({
      className: 'pickup-marker',
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="60" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="#06b6d4" stroke="#0f766e" stroke-width="2" />
        <circle cx="12" cy="9" r="3.2" fill="#ffffff" stroke="#0f766e" stroke-width="1.5" />
      </svg>`,
      iconAnchor: [22, 55],
      popupAnchor: [0, -55],
      tooltipAnchor: [0, -55],
    });

    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="60" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="#10b981" stroke="#047857" stroke-width="2" />
        <circle cx="12" cy="9" r="3.2" fill="#ffffff" stroke="#047857" stroke-width="1.5" />
      </svg>`,
      iconAnchor: [22, 55],
      popupAnchor: [0, -55],
      tooltipAnchor: [0, -55],
    });

    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="60" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="#ef4444" stroke="#7f1d1d" stroke-width="2" />
        <circle cx="12" cy="9" r="3.2" fill="#ffffff" stroke="#7f1d1d" stroke-width="1.5" />
      </svg>`,
      iconAnchor: [22, 55],
      popupAnchor: [0, -55],
      tooltipAnchor: [0, -55],
    });

    // Start pin
    if (startEndPins && route && route.length) {
      try {
        const startLatLng = L.latLng(route[0] as any);
        startMarkerRef.current = L.marker(startLatLng, { icon: startIcon, interactive: true }).addTo(map);
        try { startMarkerRef.current.bindTooltip('Start', { direction: 'top', permanent: false }); } catch (_) {}
      } catch (_) {}
    }

    // End pin
    if (startEndPins && route && route.length) {
      try {
        const endLatLng = L.latLng(route[route.length - 1] as any);
        endMarkerRef.current = L.marker(endLatLng, { icon: endIcon, interactive: true }).addTo(map);
        try { endMarkerRef.current.bindTooltip('Destination', { direction: 'top', permanent: false }); } catch (_) {}
      } catch (_) {}
    }

    if (markers && markers.length) {
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
          const marker = L.marker(latlng as any, { icon: pickupIcon, interactive: true });
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
        if (startMarkerRef.current && map.hasLayer(startMarkerRef.current)) map.removeLayer(startMarkerRef.current);
      } catch (_) {}
      try {
        if (endMarkerRef.current && map.hasLayer(endMarkerRef.current)) map.removeLayer(endMarkerRef.current);
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
      startMarkerRef.current = null;
      endMarkerRef.current = null;
    };
    // Intentionally empty deps: initialize once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update polyline when `route` changes (mutate existing layers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log('[MAP] Route update skipped - map not ready');
      return;
    }

    if (route && route.length) {
      console.log('[MAP] Updating route with', route.length, 'points');
      if (polyOutlineRef.current && polyRef.current) {
        polyOutlineRef.current.setLatLngs(route);
        polyRef.current.setLatLngs(route);
        console.log('[MAP] ✓ Existing route polylines updated');
      } else {
        console.log('[MAP] Creating new route polylines');
        try {
          polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95, renderer: L.svg() }).addTo(map);
          polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5, renderer: L.svg() }).addTo(map);
          console.log('[MAP] ✓ New route polylines created');
        } catch (e) {
          console.warn('[MAP] SVG renderer failed, using fallback:', e);
          polyOutlineRef.current = L.polyline(route, { color: '#0b1220', weight: 11, opacity: 0.95 }).addTo(map);
          polyRef.current = L.polyline(route, { color: '#FFD166', weight: 5 }).addTo(map);
        }
      }
      // Intentionally do NOT auto-fit or center the map here — keep user-controlled view
    } else {
      console.log('[MAP] Removing route polylines (no route data)');
      if (polyRef.current) { try { map.removeLayer(polyRef.current); } catch (_) {} polyRef.current = null; }
      if (polyOutlineRef.current) { try { map.removeLayer(polyOutlineRef.current); } catch (_) {} polyOutlineRef.current = null; }
    }
  }, [route]);

  // Update markers when `markers` or `route` changes (replace layer) and keep start/end pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (!markerLayerRef.current) markerLayerRef.current = L.layerGroup().addTo(map);
      else markerLayerRef.current.clearLayers();

      // Recreate pickup markers
      if (markers && markers.length) {
        const pickupIcon = L.icon({
          iconUrl: (L.Icon.Default.prototype as any).options.iconUrl,
          iconRetinaUrl: (L.Icon.Default.prototype as any).options.iconRetinaUrl,
          iconSize: [32, 50],
          iconAnchor: [16, 46],
          popupAnchor: [0, -46],
          tooltipAnchor: [0, -46],
        });
        markers.forEach((m: any) => {
          let latlng: [number, number] | null = null;
          let label: string | undefined;

          if (Array.isArray(m) && m.length >= 2) latlng = [Number(m[0]), Number(m[1])];
          else if (typeof m === 'object' && m !== null) {
            if (typeof m.lat === 'number' && typeof m.lng === 'number') {
              latlng = [m.lat, m.lng];
              label = m.label;
            } else if (Array.isArray((m as any).coordinates) && (m as any).coordinates.length >= 2) {
              latlng = [Number((m as any).coordinates[1]), Number((m as any).coordinates[0])];
            }
          }

          if (latlng) {
            const marker = L.marker(latlng as any, { icon: pickupIcon });
            if (label) {
              try { marker.bindTooltip(label, { direction: 'top', permanent: false }); } catch (_) {}
            }
            markerLayerRef.current!.addLayer(marker);
          }
        });
      }

      // Recreate start/end pins when enabled
      if (startEndPins && route && route.length) {
        const startIcon = L.divIcon({
          className: '',
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="56">
            <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="#16a34a" stroke="#0b1220" stroke-width="1.2" />
            <circle cx="12" cy="9" r="2.8" fill="#ffffff" stroke="#0b1220" stroke-width="1.2" />
          </svg>`,
          iconAnchor: [20, 50],
          popupAnchor: [0, -50],
          tooltipAnchor: [0, -50],
        });

        const endIcon = L.divIcon({
          className: '',
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="56">
            <path d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z" fill="#2563eb" stroke="#0b1220" stroke-width="1.2" />
            <circle cx="12" cy="9" r="2.8" fill="#ffffff" stroke="#0b1220" stroke-width="1.2" />
          </svg>`,
          iconAnchor: [20, 50],
          popupAnchor: [0, -50],
          tooltipAnchor: [0, -50],
        });

        const startLatLng = L.latLng(route[0] as any);
        startMarkerRef.current = L.marker(startLatLng, { icon: startIcon }).addTo(map);
        try { startMarkerRef.current.bindTooltip('Start', { direction: 'top', permanent: false }); } catch (_) {}

        if (route.length > 1) {
          const endLatLng = L.latLng(route[route.length - 1] as any);
          endMarkerRef.current = L.marker(endLatLng, { icon: endIcon }).addTo(map);
          try { endMarkerRef.current.bindTooltip('Destination', { direction: 'top', permanent: false }); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Failed to render markers', e);
    }
  }, [markers, route, startEndPins]);

  // Update bounds if provided
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { if (bounds) map.fitBounds(bounds); } catch (_) {}
  }, [bounds]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
