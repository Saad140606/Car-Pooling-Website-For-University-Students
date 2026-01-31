"use client";
import { useEffect, useState } from 'react';
import { useUser } from './use-user';

// Secure admin check: verify ID token on server and check admins/{uid}
export function useIsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function check() {
      setLoading(true);
      setError(null);
      
      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      try {
        // Get ID token from Firebase user
        const token = await user.getIdToken(true); // Force refresh to get latest claims
        if (!mounted) return;
        
        // Call API to verify admin status server-side
        const res = await fetch('/api/admin/isAdmin', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!mounted) return;

        if (res.ok) {
          const body = await res.json();
          const verified = Boolean(body?.isAdmin);
          setIsAdmin(verified);
          if (verified) {
            console.log('[useIsAdmin] Admin verified successfully');
          }
        } else {
          console.warn('[useIsAdmin] API returned error status:', res.status);
          setIsAdmin(false);
          setError(`API returned ${res.status}`);
        }
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[useIsAdmin] Error checking admin status:', msg);
          setIsAdmin(false);
          setError(msg);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    check();
    
    return () => {
      mounted = false;
    };
  }, [user]);

  return { isAdmin, loading, error };
}
