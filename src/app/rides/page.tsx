"use client";

import dynamic from 'next/dynamic';
import React from 'react';
import Logo from '@/components/logo';
import Link from 'next/link';

// Dynamically import the dashboard rides page on the client only to avoid
// server-side evaluation of browser-only libraries (Leaflet) which reference
// `window` and break SSR.
const DashboardRidesPage = dynamic(() => import('../dashboard/rides/page'), { ssr: false });

export default function RidesPage() {
  return (
    <div className="pt-12 pb-12 px-4 sm:px-6 md:px-8">  
      <DashboardRidesPage />
    </div>
  );
}