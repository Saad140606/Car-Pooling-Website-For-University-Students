import { Timestamp } from 'firebase/firestore';

const LOCK_RATE_PERCENT = 35;
const MIN_PARTICIPATIONS = 3;
const LOCK_DAYS = 7;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysRemaining(lockUntil: Date, nowMs: number): number {
  const diffMs = lockUntil.getTime() - nowMs;
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function getCancellationRatePercent(profile: any): number {
  const participations = Number(profile?.totalParticipations || 0);
  const cancellations = Number(profile?.totalCancellations || 0);
  if (participations <= 0) return 0;
  return Math.round((cancellations / participations) * 100);
}

export function shouldLockByCancellationRate(profile: any): boolean {
  const participations = Number(profile?.totalParticipations || 0);
  const rate = getCancellationRatePercent(profile);
  return participations >= MIN_PARTICIPATIONS && rate > LOCK_RATE_PERCENT;
}

export function getNewLockUntilDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOCK_DAYS * 24 * 60 * 60 * 1000);
}

export function formatAccountLockMessage(lockUntil: Date, now: Date = new Date()): string {
  const remaining = daysRemaining(lockUntil, now.getTime());
  if (remaining <= 1) {
    return 'Your account is locked for 7 days due to multiple cancellations. You can login after 1 day.';
  }
  return `Your account is locked for 7 days due to multiple cancellations. You can login after ${remaining} days.`;
}

export function getAccountLockState(profile: any, now: Date = new Date()): {
  locked: boolean;
  lockUntil?: Date;
  shouldPersistLock: boolean;
  message?: string;
} {
  const existingLockUntil = toDate(profile?.accountLockUntil);
  const nowMs = now.getTime();

  if (existingLockUntil && existingLockUntil.getTime() > nowMs) {
    return {
      locked: true,
      lockUntil: existingLockUntil,
      shouldPersistLock: false,
      message: formatAccountLockMessage(existingLockUntil, now),
    };
  }

  // If a previous lock exists and has expired, allow login again.
  // Re-locking should only happen when cancellation policy writes a new lock.
  if (existingLockUntil && existingLockUntil.getTime() <= nowMs) {
    return {
      locked: false,
      shouldPersistLock: false,
    };
  }

  if (shouldLockByCancellationRate(profile)) {
    const newLockUntil = getNewLockUntilDate(now);
    return {
      locked: true,
      lockUntil: newLockUntil,
      shouldPersistLock: true,
      message: formatAccountLockMessage(newLockUntil, now),
    };
  }

  return {
    locked: false,
    shouldPersistLock: false,
  };
}

export function toFirestoreLockTimestamp(lockUntil: Date) {
  return Timestamp.fromDate(lockUntil);
}
