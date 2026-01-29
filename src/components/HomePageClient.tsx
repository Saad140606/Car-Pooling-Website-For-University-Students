'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';

/**
 * HomePageClient: Redirects authenticated users to dashboard
 */
export function HomePageClient({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Only check after auth state is initialized
    if (!initialized || loading) return;

    // If user is authenticated, redirect to dashboard
    if (user) {
      console.debug('[HomePageClient] User is authenticated, redirecting to dashboard');
      router.replace('/dashboard/rides');
      return;
    }
  }, [user, loading, initialized, router]);

  // Show loading state while checking auth
  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="space-y-4 max-w-md w-full px-4">
          <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // User is not authenticated or is loading - show home page content
  return <>{children}</>;
}
