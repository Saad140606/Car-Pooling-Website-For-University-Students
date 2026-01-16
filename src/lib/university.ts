export type University = 'ned' | 'fast';

const SELECTED_KEY = 'selected_university';
const PENDING_KEY = 'pending_university';

export function setSelectedUniversity(u: University) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(SELECTED_KEY, u);
  } catch (e) {
    /* ignore */
  }
}

export function getSelectedUniversity(): University | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(SELECTED_KEY);
    return (v === 'ned' || v === 'fast') ? v : null;
  } catch (e) {
    return null;
  }
}

export function setPendingUniversity(u: University) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(PENDING_KEY, u);
  } catch (e) {
    /* ignore */
  }
}

export function getPendingUniversity(): University | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(PENDING_KEY);
    return (v === 'ned' || v === 'fast') ? v : null;
  } catch (e) {
    return null;
  }
}

export function clearPendingUniversity() {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(PENDING_KEY);
  } catch (e) {
    /* ignore */
  }
}

const PENDING_GENDER_KEY = 'pending_gender';

export function setPendingGender(g: 'male' | 'female') {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(PENDING_GENDER_KEY, g);
  } catch (e) { /* ignore */ }
}

export function getPendingGender(): 'male' | 'female' | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(PENDING_GENDER_KEY);
    return v === 'male' || v === 'female' ? v : null;
  } catch (e) { return null; }
}

export function clearPendingGender() {
  try { if (typeof window !== 'undefined') localStorage.removeItem(PENDING_GENDER_KEY); } catch (e) { /* ignore */ }
}

export function isValidUniversity(u: unknown): u is University {
  return u === 'ned' || u === 'fast';
}
