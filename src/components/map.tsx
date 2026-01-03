'use client';

import dynamic from 'next/dynamic';

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

export const useMap = dynamic(
    () => import('react-leaflet').then((mod) => mod.useMap),
    { ssr: false }
);

export const useMapEvents = dynamic(
    () => import('react-leaflet').then((mod) => mod.useMapEvents),
    { ssr: false }
);
