'use client';

import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import { useUser } from '@/firebase';

/**
 * Safe Navigation Hook
 * Prevents navigation to pages without required data/auth
 * Provides graceful redirects and error handling
 */
export function useSafeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, initialized, data: userData } = useUser();

  /**
   * Redirect to auth if not authenticated
   */
  useEffect(() => {
    if (!initialized) return; // Wait for auth to initialize

    // Add small delay to avoid false positives during hydration
    const timeout = setTimeout(() => {
      if (!user && !loading) {
        // Only redirect if we're in a protected route
        const protectedRoutes = [
          '/dashboard',
          '/bookings',
          '/chat',
          '/profile',
        ];

        const isProtectedRoute = protectedRoutes.some((route) =>
          pathname.startsWith(route)
        );

        if (isProtectedRoute) {
          router.replace('/auth/select-university');
        }
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [initialized, user, loading, pathname, router]);

  /**
   * Redirect if university data is missing
   */
  useEffect(() => {
    if (!user || !initialized || !pathname.startsWith('/dashboard')) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!userData?.university) {
        router.replace('/auth/select-university');
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [user, initialized, userData?.university, pathname, router]);

  /**
   * Safe redirect function
   */
  const safeRedirect = (path: string, options?: { requireAuth?: boolean; requireUniversity?: boolean }) => {
    try {
      if (options?.requireAuth && !user) {
        router.replace('/auth/select-university');
        return;
      }

      if (options?.requireUniversity && !userData?.university) {
        router.replace('/auth/select-university');
        return;
      }

      router.push(path);
    } catch (error) {
      console.debug('[useSafeNavigation] Error redirecting:', error);
      // Fallback to window.location
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    }
  };

  /**
   * Safe go back function
   */
  const safeGoBack = () => {
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.debug('[useSafeNavigation] Error going back:', error);
      router.push('/dashboard');
    }
  };

  /**
   * Safe link href generator
   */
  const getSafeHref = (path: string): string | null => {
    if (!initialized || !user) return null;
    if (pathname.startsWith('/dashboard') && !userData?.university) return null;
    return path;
  };

  return {
    router,
    safeRedirect,
    safeGoBack,
    getSafeHref,
    isReady: initialized && !!user,
  };
}
