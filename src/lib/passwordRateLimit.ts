// src/lib/passwordRateLimit.ts
import { Timestamp } from 'firebase/firestore';

export const PASSWORD_CHANGE_LIMIT = 3;
export const PASSWORD_CHANGE_WINDOW_DAYS = 14;
export const PASSWORD_CHANGE_WINDOW_MS = PASSWORD_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface PasswordChangeTracking {
  passwordChangeCount: number;
  passwordChangeWindowStart: Timestamp | Date | null;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetDate: Date | null;
  message: string;
}

/**
 * Check if a user can change their password based on rate limiting rules
 * @param tracking - Current password change tracking data from Firestore
 * @returns RateLimitResult with allowed status and details
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

  // Convert Timestamp to Date if needed
  const windowStart = tracking.passwordChangeWindowStart && typeof (tracking.passwordChangeWindowStart as any).toDate === 'function'
    ? (tracking.passwordChangeWindowStart as any).toDate()
    : new Date(tracking.passwordChangeWindowStart);

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
 * @param currentTracking - Current password change tracking data
 * @returns Updated tracking data
 */
export function updatePasswordChangeTracking(
  currentTracking: PasswordChangeTracking | null | undefined
): PasswordChangeTracking {
  const now = new Date();
  
  // First password change - start new window
  if (!currentTracking || !currentTracking.passwordChangeWindowStart) {
    return {
      passwordChangeCount: 1,
      passwordChangeWindowStart: now,
    };
  }

  // Convert Timestamp to Date if needed
  const windowStart = currentTracking.passwordChangeWindowStart && typeof (currentTracking.passwordChangeWindowStart as any).toDate === 'function'
    ? (currentTracking.passwordChangeWindowStart as any).toDate()
    : new Date(currentTracking.passwordChangeWindowStart);

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
    passwordChangeWindowStart: currentTracking.passwordChangeWindowStart,
  };
}

/**
 * Format a date to a readable string showing when password changes will be available again
 */
export function formatResetDate(date: Date | null): string {
  if (!date) return '';
  
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  
  if (days <= 0) return 'now';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  
  if (weeks === 1) {
    return remainingDays === 0 ? 'in 1 week' : `in 1 week and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }
  
  return remainingDays === 0 ? `in ${weeks} weeks` : `in ${weeks} weeks and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
}
