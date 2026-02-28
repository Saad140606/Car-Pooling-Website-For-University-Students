export type RideActionRole = 'driver' | 'passenger';

export interface ActiveRideLock {
  lockUntil: Date;
  lockDays: number;
  role?: RideActionRole;
}

function toDateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getActiveRideLock(userData: any, now: Date = new Date()): ActiveRideLock | null {
  if (!userData) return null;

  const accountLockUntil = toDateValue(userData.accountLockUntil);
  const accountLockDays = Number(userData.accountLockDays || 0);
  const accountLockRole = userData.accountLockRole === 'driver' || userData.accountLockRole === 'passenger'
    ? userData.accountLockRole
    : undefined;

  if (!accountLockUntil || now >= accountLockUntil) {
    return null;
  }

  return {
    lockUntil: accountLockUntil,
    lockDays: accountLockDays > 0 ? accountLockDays : 7,
    role: accountLockRole,
  };
}

export function formatRideLockMessage(lockUntil: Date, lockDays: number): string {
  const dateText = lockUntil.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `Your account is locked for ${lockDays} day${lockDays === 1 ? '' : 's'} due to many cancellations. You can still log in, but you cannot request or offer a ride until ${dateText}.`;
}
