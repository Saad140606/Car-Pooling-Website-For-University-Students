'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useAuth, useFirestore } from '@/firebase';
import { getSelectedUniversity } from '@/lib/university';
import { resolveDashboardLandingRoute } from '@/lib/dashboardLanding';

/**
 * RootPageGuard: Handles auth-based routing at the root level
 * 
 * CRITICAL BEHAVIOR:
 * - If user IS authenticated → Redirect to /dashboard/rides IMMEDIATELY
 * - If user NOT authenticated → Show Home page content
 * - While checking auth → Show minimal loading (invisible)
 * 
 * This component MUST be synchronous with auth state check to prevent page flicker
 */
export function RootPageGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized, data: userData } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const verificationHandledRef = useRef(false);
  const dashboardRedirectHandledUidRef = useRef<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Only act once auth is initialized
      if (!initialized) return;
      
      // If still loading, wait
      if (loading) return;

      // If user is authenticated, handle email verification before routing to dashboard
      if (user) {
        const isVerified = Boolean((userData as any)?.universityEmailVerified ?? (userData as any)?.emailVerified);
        const university = (userData as any)?.university || null;

        if (university && !isVerified && !verificationHandledRef.current) {
          verificationHandledRef.current = true;
          setIsRedirecting(true);
          // Send OTP for verification
          try {
            await fetch('/api/send-signup-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: user.uid, email: user.email, university }),
            });
          } catch (_) {
            // ignore OTP send errors; verify page can resend
          }

          // Sign out to prevent access until verified
          try {
            await auth?.signOut();
          } catch (_) {}

          router.replace(`/auth/verify-email?email=${encodeURIComponent(user.email || '')}&university=${university}&uid=${user.uid}`);
          return;
        }

        if (dashboardRedirectHandledUidRef.current === user.uid) {
          return;
        }
        dashboardRedirectHandledUidRef.current = user.uid;

        const fallbackUniversity = getSelectedUniversity();
        const resolvedUniversity = university || fallbackUniversity || null;
        const destination = await resolveDashboardLandingRoute({
          firestore,
          uid: user.uid,
          university: resolvedUniversity,
        });

        console.debug('[RootPageGuard] Authenticated user detected, redirecting to:', destination);
        setIsRedirecting(true);
        router.replace(destination);
        return;
      }

      dashboardRedirectHandledUidRef.current = null;

      // User is not authenticated, show home page (no action needed)
    };

    run();
  }, [initialized, loading, user, userData, auth, router, firestore]);

  // CRITICAL: Return null during auth check (invisible to user)
  // This prevents the Home page from rendering and being discarded
  if (!initialized || loading) {
    return null;
  }

  // If redirecting authenticated user, return null (redirect in progress)
  if (isRedirecting) {
    return null;
  }

  // User is NOT authenticated - show home page content
  return <>{children}</>;
}
