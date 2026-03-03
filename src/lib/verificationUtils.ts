/**
 * Verification Utilities
 * 
 * Centralized logic for determining user verification status.
 * A user is VERIFIED if and only if:
 * - universityEmailVerified === true
 * - idVerified === true
 */

/**
 * Determine if a user is verified
 * @param user User object with verification flags
 * @returns true if user is fully verified (email + ID)
 */
export function isUserVerified(user: any): boolean {
  if (!user) return false;
  
  const hasEmailVerification = user.universityEmailVerified === true;
  const hasIdVerification = user.idVerified === true;
  
  return hasEmailVerification && hasIdVerification;
}

/**
 * Safely extract display name with fallback
 * @param user User object
 * @param fallback Fallback name if user or name is missing
 * @returns Display name
 */
export function getUserDisplayName(user: any, fallback = 'User'): string {
  if (!user) return fallback;
  return user.fullName || user.displayName || user.name || fallback;
}

/**
 * Get verification state from user object
 * Tries multiple fields for compatibility with different data structures
 */
export function getVerificationState(user: any): {
  emailVerified: boolean;
  idVerified: boolean;
  isVerified: boolean;
} {
  if (!user) {
    return { emailVerified: false, idVerified: false, isVerified: false };
  }

  const emailVerified = user.universityEmailVerified === true;
  const idVerified = user.idVerified === true;

  return {
    emailVerified,
    idVerified,
    isVerified: emailVerified && idVerified,
  };
}

/**
 * Extract safe user info for display in UI
 */
export function extractUserInfo(user: any) {
  const displayName = getUserDisplayName(user);
  const verificationState = getVerificationState(user);

  return {
    displayName,
    ...verificationState,
  };
}
