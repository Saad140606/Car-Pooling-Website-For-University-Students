"use client";

import dynamic from 'next/dynamic';
import React from 'react';
import Logo from '@/components/logo';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { useUser } from '@/firebase';

// Dynamically import the dashboard rides page on the client only to avoid
// server-side evaluation of browser-only libraries (Leaflet) which reference
// `window` and break SSR.
const DashboardRidesPage = dynamic(() => import('../dashboard/rides/page'), { ssr: false });

export default function RidesPage() {
  const { user } = useUser();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
      {/* Show header only for non-logged-in users */}
      {!user && <SiteHeader />}
      
      <div className={!user ? "pb-12 px-4 sm:px-6 md:px-8" : "pt-12 pb-12 px-4 sm:px-6 md:px-8"}>
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '1.5s' }} />
        </div>
        <DashboardRidesPage />
      </div>
    </div>
  );
}