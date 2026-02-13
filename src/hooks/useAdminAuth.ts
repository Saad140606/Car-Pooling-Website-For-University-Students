/**
 * Admin Authentication Hook
 * 
 * Verifies user is an authenticated admin before allowing access to admin features.
 * 
 * Security Features:
 * - Verifies Firebase authentication
 * - Checks admin role via backend API
 * - Blocks non-admin users immediately
 * - Redirects unauthorized users to login
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

interface AdminAuthState {
  loading: boolean;
  isAdmin: boolean;
  uid: string | null;
  email: string | null;
  error: string | null;
}

export function useAdminAuth() {
  const router = useRouter();
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    isAdmin: false,
    uid: null,
    email: null,
    error: null,
  });

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not signed in at all - redirect to admin login
        console.log('[useAdminAuth] No user signed in, redirecting to login');
        setState({
          loading: false,
          isAdmin: false,
          uid: null,
          email: null,
          error: 'Not authenticated',
        });
        router.replace('/admin-login');
        return;
      }

      console.log('[useAdminAuth] User authenticated, verifying admin role:', user.uid);

      try {
        // Get Firebase ID token
        const idToken = await user.getIdToken();

        // Verify admin role with backend
        const response = await fetch('/api/admin/isAdmin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email: user.email }),
        });

        const data = await response.json();

        if (data.isAdmin) {
          console.log('[useAdminAuth] ✅ Admin role verified:', user.email);
          setState({
            loading: false,
            isAdmin: true,
            uid: user.uid,
            email: user.email,
            error: null,
          });
        } else {
          // Not an admin - sign out and redirect
          console.warn('[useAdminAuth] ❌ User is not an admin:', user.email);
          await auth.signOut();
          setState({
            loading: false,
            isAdmin: false,
            uid: null,
            email: null,
            error: 'Admin account not found or unauthorized access',
          });
          router.replace('/admin-login?error=unauthorized');
        }
      } catch (error) {
        console.error('[useAdminAuth] Error verifying admin role:', error);
        await auth.signOut();
        setState({
          loading: false,
          isAdmin: false,
          uid: null,
          email: null,
          error: 'Failed to verify admin status',
        });
        router.replace('/admin-login?error=verification-failed');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return state;
}

/**
 * Admin Guard Component Wrapper
 * 
 * Usage:
 * ```tsx
 * export default function AdminPage() {
 *   const { loading, isAdmin } = useAdminAuth();
 *   
 *   if (loading) return <LoadingScreen />;
 *   if (!isAdmin) return null; // Will redirect automatically
 *   
 *   return <AdminContent />;
 * }
 * ```
 */
