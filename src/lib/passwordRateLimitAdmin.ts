// src/lib/passwordRateLimitAdmin.ts
/**
 * Admin-side password rate limit utilities for API routes
 * Uses Firebase Admin SDK
 */

export const PASSWORD_CHANGE_LIMIT = 3;
export const PASSWORD_CHANGE_WINDOW_DAYS = 14;
export const PASSWORD_CHANGE_WINDOW_MS = PASSWORD_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface PasswordChangeTracking {
  passwordChangeCount?: number;
  passwordChangeWindowStart?: FirebaseFirestore.Timestamp | Date | null;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetDate: Date | null;
  message: string;
}

/**
 * Check if a user can change their password based on rate limiting rules (Admin SDK version)
 */
export function checkPasswordChangeRateLimit(
  tracking: PasswordChangeTracking | null | undefined
): RateLimitResult {
  const now = new Date();
  
  // If no tracking data exists, allow first change
  if (!tracking || !tracking.passwordChangeWindowStart) {
    return {
      allowed: true,
      count: 0,
      remaining: PASSWORD_CHANGE_LIMIT,
      resetDate: null,
      message: `You have ${PASSWORD_CHANGE_LIMIT} password changes available.`,
    };
  }

  // Convert Firestore Timestamp to Date if needed
  const windowStart = tracking.passwordChangeWindowStart && 'toDate' in tracking.passwordChangeWindowStart
    ? tracking.passwordChangeWindowStart.toDate()
    : new Date(tracking.passwordChangeWindowStart as any);

  const windowElapsed = now.getTime() - windowStart.getTime();
  const count = tracking.passwordChangeCount || 0;

  // If window has passed, allow change (will reset in update)
  if (windowElapsed >= PASSWORD_CHANGE_WINDOW_MS) {
    return {
      allowed: true,
      count: 0,
      remaining: PASSWORD_CHANGE_LIMIT,
      resetDate: null,
      message: `You have ${PASSWORD_CHANGE_LIMIT} password changes available.`,
    };
  }

  // Within window - check if limit reached
  if (count >= PASSWORD_CHANGE_LIMIT) {
    const resetDate = new Date(windowStart.getTime() + PASSWORD_CHANGE_WINDOW_MS);
    const daysLeft = Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return {
      allowed: false,
      count,
      remaining: 0,
      resetDate,
      message: `You have reached the maximum of ${PASSWORD_CHANGE_LIMIT} password changes in ${PASSWORD_CHANGE_WINDOW_DAYS} days. Please try again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
    };
  }

  // Within window, under limit
  const remaining = PASSWORD_CHANGE_LIMIT - count;
  return {
    allowed: true,
    count,
    remaining,
    resetDate: new Date(windowStart.getTime() + PASSWORD_CHANGE_WINDOW_MS),
    message: `You have ${remaining} password change${remaining !== 1 ? 's' : ''} remaining in this period.`,
  };
}

/**
 * Calculate new tracking data after a successful password change
 */
export function getUpdatedPasswordChangeTracking(
  currentTracking: PasswordChangeTracking | null | undefined
): { passwordChangeCount: number; passwordChangeWindowStart: Date } {
  const now = new Date();
  
  // First password change - start new window
  if (!currentTracking || !currentTracking.passwordChangeWindowStart) {
    return {
      passwordChangeCount: 1,
      passwordChangeWindowStart: now,
    };
  }

  // Convert Firestore Timestamp to Date if needed
  const windowStart = currentTracking.passwordChangeWindowStart && 'toDate' in currentTracking.passwordChangeWindowStart
    ? currentTracking.passwordChangeWindowStart.toDate()
    : new Date(currentTracking.passwordChangeWindowStart as any);

  const windowElapsed = now.getTime() - windowStart.getTime();

  // If window has passed, start new window
  if (windowElapsed >= PASSWORD_CHANGE_WINDOW_MS) {
    return {
      passwordChangeCount: 1,
      passwordChangeWindowStart: now,
    };
  }

  // Within window - increment count
  return {
    passwordChangeCount: (currentTracking.passwordChangeCount || 0) + 1,
    passwordChangeWindowStart: windowStart,
  };
}
