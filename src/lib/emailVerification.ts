/**
 * Email Verification Utility
 * 
 * CRITICAL SECURITY: This module enforces email verification for all users.
 * Users MUST verify their email before accessing protected routes.
 */

import { Firestore, doc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface EmailVerificationStatus {
  isVerified: boolean;
  university?: 'ned' | 'fast';
  requiresVerification: boolean;
}

/**
 * Check if a user's email is verified in Firestore
 * 
 * SECURITY: This is the single source of truth for email verification status.
 * All authentication checks MUST use this function.
 * 
 * @param firestore - Firestore instance
 * @param user - Firebase Auth user
 * @param targetUniversity - The university the user is trying to access (optional)
 * @returns Verification status object
 */
export async function checkEmailVerification(
  firestore: Firestore,
  user: User,
  targetUniversity?: 'ned' | 'fast'
): Promise<EmailVerificationStatus> {
  if (!user?.uid) {
    return {
      isVerified: false,
      requiresVerification: true,
    };
  }

  // Check if user is admin (admins bypass verification)
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  
  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return {
      isVerified: true,
      requiresVerification: false,
    };
  }

  // Try both universities if target not specified
  const universitiesToCheck: Array<'ned' | 'fast'> = targetUniversity 
    ? [targetUniversity] 
    : ['ned', 'fast'];

  for (const uni of universitiesToCheck) {
    try {
      const userDocRef = doc(firestore, 'universities', uni, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const emailVerified = Boolean(userData?.emailVerified);
        
        return {
          isVerified: emailVerified,
          university: uni,
          requiresVerification: !emailVerified,
        };
      }
    } catch (error) {
      console.error(`Error checking verification for ${uni}:`, error);
    }
  }

  // User not found in any university - requires verification
  return {
    isVerified: false,
    requiresVerification: true,
  };
}

/**
 * Get the verification redirect URL
 * 
 * @param email - User's email
 * @param university - University code
 * @param uid - User's Firebase UID
 * @returns URL to redirect to for verification
 */
export function getVerificationRedirectUrl(
  email: string,
  university: string,
  uid: string
): string {
  return `/auth/verify-email?email=${encodeURIComponent(email)}&university=${university}&uid=${uid}`;
}
