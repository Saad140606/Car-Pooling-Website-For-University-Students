"use client";

import React from 'react';
import { GraduationCap } from "lucide-react";

export default function UniversityContextBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-white/5 text-white shadow-sm ${className}`}>
      <div className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm md:text-base font-semibold">Campus Ride</div>
            <div className="text-xs md:text-sm text-muted-foreground">Your trusted campus carpooling platform.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
