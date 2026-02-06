"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff, Menu } from "lucide-react";
import { useAuth } from "@/firebase";
import { getAuth } from "firebase/auth";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authContext = useAuth();
  const user = authContext?.user;
  const loading = authContext?.loading;
  
  const [isReady, setIsReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("adminSidebarCollapsed") : null;
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("adminSidebarCollapsed", sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  const handleToggleSidebar = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setMobileOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    // Only check if user is logged in - no role verification
    if (loading) return;

    // If authContext already has user, allow access
    if (user) {
      setIsReady(true);
      return;
    }

    // Fallback: check Firebase directly (handles race after signInWithEmailAndPassword)
    try {
      const authDirect = getAuth();
      const current = authDirect.currentUser;
      if (current) {
        setIsReady(true);
        return;
      }
    } catch (err) {
      // ignore
    }

    // No user found, redirect to login
    router.replace('/admin-login');
  }, [user, loading, router]);

  if (loading || !isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-white/60">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Final access check: use Firebase's currentUser directly to avoid races
  const directUser = (() => {
    try {
      return getAuth().currentUser;
    } catch (_) {
      return null;
    }
  })();

  if (!directUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-4 bg-red-500/20 rounded-full w-fit mx-auto">
            <ShieldOff className="w-16 h-16 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">Access Denied</h1>
          <p className="text-white/60">You must be logged in to access the admin dashboard.</p>
          <button
            onClick={() => router.push('/admin-login')}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 h-14">
            <button
              onClick={handleToggleSidebar}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm md:text-base text-slate-300 font-medium">Admin Dashboard</div>
            <div className="w-10 h-10" />
          </div>
        </header>

        <div className="px-4 md:px-6 lg:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
