"use client";
import { useEffect, useState } from 'react';
import { useUser } from './use-user';

/**
 * IMPORTANT: This hook should ONLY be used in admin-specific pages
 * NOT in regular user dashboard or user flows
 * 
 * For security: Returns false immediately to prevent accidental admin checks in user flows
 */
export function useIsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DISABLED: Do not use this hook in user flows
  // Admin checks should only happen in /admin-login and /admin-dashboard
  // Regular users should never trigger admin verification
  
  useEffect(() => {
    // Immediately return false - this hook should not be used in user flows
    setIsAdmin(false);
    setLoading(false);
    
    // If you need admin checks, use them directly in admin pages with fetch('/api/admin/isAdmin')
    // Do NOT use this hook in dashboard layout or user components
  }, [user]);

  return { isAdmin, loading, error };
}
