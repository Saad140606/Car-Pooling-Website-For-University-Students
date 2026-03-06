'use client';

import type { Icon } from 'leaflet';
import { createMapPin } from '@/components/map';

export type RoutePinVariant = 'start' | 'end' | 'pickup' | 'default';

const PIN_COLORS: Record<RoutePinVariant, string> = {
  start: '#22c55e',
  end: '#ef4444',
  pickup: '#f59e0b',
  default: '#E84C3D',
};

const iconCache = new Map<RoutePinVariant, Icon>();

const getLeaflet = (): typeof import('leaflet') | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  // Lazy-require Leaflet in browser only, so server prerender does not evaluate window-dependent code.
  return require('leaflet') as typeof import('leaflet');
};

export function getRoutePinIcon(variant: RoutePinVariant = 'default'): Icon | undefined {
  const L = getLeaflet();
  if (!L) {
    return undefined;
  }

  const cached = iconCache.get(variant);
  if (cached) return cached;

  const color = PIN_COLORS[variant] || PIN_COLORS.default;
  const icon = L.icon({
    iconUrl: createMapPin(color),
    iconRetinaUrl: createMapPin(color),
    shadowUrl: '',
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -42],
    tooltipAnchor: [16, -32],
  });

  iconCache.set(variant, icon);
  return icon;
}
