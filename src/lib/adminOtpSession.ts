export const ADMIN_OTP_SESSION_KEY = 'admin_otp_session_v1';
export const ADMIN_OTP_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface AdminOtpSession {
  uid: string;
  email: string | null;
  verifiedAt: number;
  expiresAt: number;
}

export function saveAdminOtpSession(uid: string, email: string | null) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const payload: AdminOtpSession = {
    uid,
    email,
    verifiedAt: now,
    expiresAt: now + ADMIN_OTP_SESSION_TTL_MS,
  };
  window.sessionStorage.setItem(ADMIN_OTP_SESSION_KEY, JSON.stringify(payload));
}

export function getAdminOtpSession(): AdminOtpSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(ADMIN_OTP_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AdminOtpSession;
    if (!parsed?.uid || !parsed?.expiresAt) {
      window.sessionStorage.removeItem(ADMIN_OTP_SESSION_KEY);
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(ADMIN_OTP_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(ADMIN_OTP_SESSION_KEY);
    return null;
  }
}

export function isAdminOtpSessionValid(expectedUid?: string): boolean {
  const session = getAdminOtpSession();
  if (!session) return false;
  if (expectedUid && session.uid !== expectedUid) return false;
  return true;
}

export function clearAdminOtpSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_OTP_SESSION_KEY);
}
