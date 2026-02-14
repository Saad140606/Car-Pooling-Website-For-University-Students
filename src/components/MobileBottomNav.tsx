'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, PlusCircle, Car, User, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';

const navItems = [
  { href: '/dashboard/rides', icon: Search, label: 'Find' },
  { href: '/dashboard/my-rides', icon: Car, label: 'My Rides' },
  { href: '/dashboard/create-ride', icon: PlusCircle, label: 'Offer', isCenter: true },
  { href: '/dashboard/my-bookings', icon: User, label: 'Bookings' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Stats' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-end justify-around px-1 pt-1.5 pb-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const hasNotification = (item.label === 'My Rides' && (unreadCount.ride_status + unreadCount.booking) > 0) ||
            (item.label === 'Bookings' && (unreadCount.booking + unreadCount.chat) > 0);

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4 relative"
              >
                <div className={cn(
                  'flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary shadow-primary/40 scale-105'
                    : 'bg-gradient-to-br from-primary/80 to-accent/60 shadow-primary/20'
                )}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <span className={cn(
                  'text-[10px] mt-1 font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-slate-400'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-1.5 px-2 relative min-w-[56px]"
            >
              <div className="relative">
                <item.icon className={cn(
                  'w-5 h-5 transition-all duration-200',
                  isActive ? 'text-primary scale-110' : 'text-slate-400'
                )} />
                {hasNotification && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-950" />
                )}
              </div>
              <span className={cn(
                'text-[10px] mt-1 font-medium transition-colors leading-tight',
                isActive ? 'text-primary' : 'text-slate-400'
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
