'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AuthGuard: Protects routes by ensuring user is authenticated
 * Redirects to login if not authenticated
 * Shows loading state while checking auth status
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    // After a short delay to allow auth restoration
    const timer = setTimeout(() => {
      if (!user && !loading) {
        console.debug('[AuthGuard] User not authenticated, redirecting to login');
        router.replace('/auth/ned/login');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [user, loading, initialized, router]);

  // Show loading while auth state is being determined
  if (!initialized || loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // User not authenticated - don't render content
  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 bg-slate-800 rounded-full animate-pulse mx-auto" />
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // User is authenticated - render children
  return <>{children}</>;
}
