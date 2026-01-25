export interface PendingBooking {
  rideId: string;
  university?: string | null;
}

const KEY = 'pending_booking';

export function setPendingBooking(b: PendingBooking) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(b));
  } catch (e) { /* ignore */ }
}

export function getPendingBooking(): PendingBooking | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(KEY);
    if (!v) return null;
    return JSON.parse(v) as PendingBooking;
  } catch (e) { return null; }
}

export function clearPendingBooking() {
  try { if (typeof window !== 'undefined') localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
