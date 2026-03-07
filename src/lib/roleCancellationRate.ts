export type CancellationRole = 'driver' | 'passenger';

function toFiniteNumber(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRateFromRatio(cancelled: number, total: number): number {
  if (!Number.isFinite(cancelled) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((cancelled / total) * 100);
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  if (rate < 0) return 0;
  if (rate > 100) return 100;
  return Math.round(rate);
}

function getPolicy(userData: any, role: CancellationRole): any {
  return role === 'driver'
    ? userData?.driverCancellationPolicy || {}
    : userData?.passengerCancellationPolicy || {};
}

/**
 * Resolves cancellation rate for a specific role exactly as role-policy data intends.
 * This intentionally avoids mixed `totalParticipations/totalCancellations` fallback,
 * which can blend driver and passenger histories into one percentage.
 */
export function getRoleCancellationRate(userData: any, role: CancellationRole): number {
  const policy = getPolicy(userData, role);

  const directPolicyRate = toFiniteNumber(policy?.cancellationRate);
  if (directPolicyRate !== null) {
    return clampRate(directPolicyRate);
  }

  const completedWindow = toFiniteNumber(policy?.completedRidesWindow) ?? 0;
  const cancelledWindow = toFiniteNumber(policy?.cancelledRidesWindow) ?? 0;
  const windowBase = completedWindow + cancelledWindow;
  if (windowBase > 0) {
    return clampRate(toRateFromRatio(cancelledWindow, windowBase));
  }

  const totalWindow = toFiniteNumber(policy?.totalRidesWindow) ?? 0;
  if (totalWindow > 0) {
    return clampRate(toRateFromRatio(cancelledWindow, totalWindow));
  }

  return 0;
}
