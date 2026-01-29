/**
 * Session Manager: Handles persistent auth session storage and restoration
 * Ensures user stays logged in across app close/reopen, background/foreground
 */

const SESSION_STORAGE_KEY = 'campus_ride_session';
const SESSION_TIMESTAMP_KEY = 'campus_ride_session_timestamp';
const SESSION_EXPIRY_DAYS = 30; // Session valid for 30 days

export interface SessionData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  university?: string;
  timestamp: number;
}

/**
 * Save user session to secure storage
 */
export function saveSession(sessionData: SessionData): void {
  if (typeof window === 'undefined') return;

  try {
    const dataToStore: SessionData = {
      ...sessionData,
      timestamp: Date.now(),
    };

    // Try to use sessionStorage first (more secure), fall back to localStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dataToStore));
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dataToStore));
      localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    }

    console.debug('[SessionManager] Session saved for user:', sessionData.uid);
  } catch (error) {
    console.warn('[SessionManager] Failed to save session:', error);
  }
}

/**
 * Retrieve stored session from storage
 */
export function getStoredSession(): SessionData | null {
  if (typeof window === 'undefined') return null;

  try {
    let storedData: string | null = null;
    let storedTimestamp: string | null = null;

    // Try sessionStorage first, then localStorage
    if (typeof sessionStorage !== 'undefined') {
      storedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      storedTimestamp = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
    } else if (typeof localStorage !== 'undefined') {
      storedData = localStorage.getItem(SESSION_STORAGE_KEY);
      storedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    }

    if (!storedData || !storedTimestamp) {
      return null;
    }

    const timestamp = parseInt(storedTimestamp, 10);
    const expiryMs = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - timestamp > expiryMs;

    if (isExpired) {
      console.debug('[SessionManager] Session has expired, clearing...');
      clearSession();
      return null;
    }

    const session: SessionData = JSON.parse(storedData);
    console.debug('[SessionManager] Retrieved valid session for user:', session.uid);
    return session;
  } catch (error) {
    console.warn('[SessionManager] Failed to retrieve session:', error);
    return null;
  }
}

/**
 * Clear stored session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    }

    console.debug('[SessionManager] Session cleared');
  } catch (error) {
    console.warn('[SessionManager] Failed to clear session:', error);
  }
}

/**
 * Check if there's a valid stored session
 */
export function hasValidSession(): boolean {
  return getStoredSession() !== null;
}

/**
 * Refresh session timestamp to extend expiry
 */
export function refreshSessionTimestamp(): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    }
    console.debug('[SessionManager] Session timestamp refreshed');
  } catch (error) {
    console.warn('[SessionManager] Failed to refresh session timestamp:', error);
  }
}
