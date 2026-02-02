'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';

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
  const { user, loading, initialized } = useUser();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Only act once auth is initialized
    if (!initialized) return;
    
    // If still loading, wait
    if (loading) return;

    // If user is authenticated, redirect immediately
    if (user) {
      console.debug('[RootPageGuard] Authenticated user detected, redirecting to dashboard');
      setIsRedirecting(true);
      router.replace('/dashboard/rides');
      return;
    }

    // User is not authenticated, show home page (no action needed)
  }, [initialized, loading, user, router]);

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
