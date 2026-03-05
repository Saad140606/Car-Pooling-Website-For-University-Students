'use client';

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-8W1RSJZRFT';

type GAParamValue = string | number | boolean | null | undefined;
type GAParams = Record<string, GAParamValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
    __campusRidesLastPageViewPath?: string;
  }
}

function canTrack(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && !!GA_MEASUREMENT_ID;
}

function normalizeParams(params?: GAParams): Record<string, string | number | boolean> {
  if (!params) return {};
  const normalized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      normalized[key] = value.slice(0, 200);
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

async function sha256(value: string): Promise<string> {
  const input = value.trim().toLowerCase();
  if (!input) return '';

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export function trackEvent(eventName: string, params?: GAParams) {
  if (!canTrack()) return;
  window.gtag?.('event', eventName, normalizeParams(params));
}

export function trackPageView(path: string, title?: string, url?: string) {
  if (!canTrack()) return;
  if (!path) return;

  if (window.__campusRidesLastPageViewPath === path) {
    return;
  }

  window.__campusRidesLastPageViewPath = path;

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    page_location: url || (typeof window !== 'undefined' ? window.location.href : ''),
  });
}

export async function setAnalyticsUser(uid: string | null | undefined) {
  if (!canTrack()) return;
  if (!uid) {
    window.gtag?.('set', 'user_properties', { anonymous_user_id: undefined });
    return;
  }

  const anonymizedId = await sha256(uid);
  if (!anonymizedId) return;

  window.gtag?.('set', 'user_properties', {
    anonymous_user_id: anonymizedId,
  });
}
