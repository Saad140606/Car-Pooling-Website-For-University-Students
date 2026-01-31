'use client';

import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import { useUser, useIsAdmin } from '@/firebase';

/**
 * Safe Navigation Hook
 * Prevents navigation to pages without required data/auth
 * Provides graceful redirects and error handling
 * 
 * CRITICAL: Admin users bypass all university/onboarding checks
 */
export function useSafeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, initialized, data: userData } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  
  // Check if current path is an admin route
  const isAdminRoute = pathname?.startsWith('/dashboard/admin');

  /**
   * CRITICAL: Unified auth and admin redirect logic
   */
  useEffect(() => {
    if (!initialized) return;

    // For admin routes: wait for admin check to complete
    if (isAdminRoute && adminLoading) return;
    
    // For admin routes: if confirmed admin, allow access
    if (isAdminRoute && isAdmin && user) {
      return;
    }
    
    // For admin routes: if not admin, deny access
    if (isAdminRoute && !adminLoading && !isAdmin) {
      router.replace('/auth/select-university');
      return;
    }
    
    // For non-admin routes: check if user is authenticated
    const timeout = setTimeout(() => {
      if (!user && !loading) {
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
  }, [initialized, user, loading, pathname, router, isAdmin, adminLoading, isAdminRoute]);

  /**
   * University requirement check
   * SKIP for admin routes - admins don't need university data
   */
  useEffect(() => {
    if (!user || !initialized || !pathname.startsWith('/dashboard')) {
      return;
    }
    
    // Admin users bypass university requirement completely
    if (isAdmin) {
      return;
    }
    
    // If still checking admin status, wait before redirecting
    if (adminLoading) {
      return;
    }
    
    // Admin routes bypass university requirement
    if (isAdminRoute) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!userData?.university) {
        router.replace('/auth/select-university');
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [user, initialized, userData?.university, pathname, router, isAdminRoute, isAdmin, adminLoading]);

  /**
   * Safe redirect function
   * Admin routes bypass auth/university requirements
   */
  const safeRedirect = (path: string, options?: { requireAuth?: boolean; requireUniversity?: boolean }) => {
    try {
      // Admin routes bypass all requirements
      const targetIsAdmin = path.startsWith('/dashboard/admin') || path.startsWith('/admin');
      
      if (!targetIsAdmin && options?.requireAuth && !user) {
        router.replace('/auth/select-university');
        return;
      }

      if (!targetIsAdmin && options?.requireUniversity && !userData?.university) {
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
