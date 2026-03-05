'use client';

import L from 'leaflet';
import { createMapPin } from '@/components/map';

export type RoutePinVariant = 'start' | 'end' | 'pickup' | 'default';

const PIN_COLORS: Record<RoutePinVariant, string> = {
  start: '#22c55e',
  end: '#ef4444',
  pickup: '#f59e0b',
  default: '#E84C3D',
};

const iconCache = new Map<RoutePinVariant, L.Icon>();

export function getRoutePinIcon(variant: RoutePinVariant = 'default'): L.Icon {
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
