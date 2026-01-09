"use client";
import { useEffect, useState } from 'react';
import { useUser } from './use-user';

// Secure admin check: ask server to verify the ID token and check admins/{uid}
export function useIsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function check() {
      setLoading(true);
      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/isAdmin', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!mounted) return;
        if (res.ok) {
          const body = await res.json();
          setIsAdmin(Boolean(body?.isAdmin));
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    check();
    return () => { mounted = false; };
  }, [user]);

  return { isAdmin, loading };
}
