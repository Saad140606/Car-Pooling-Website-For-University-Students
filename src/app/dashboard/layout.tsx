'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Car, LogOut, PlusCircle, Search, User, Mail, Flag, AlertTriangle, BarChart3, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ErrorState } from '@/components/StateComponents';
import { useToast } from '@/hooks/use-toast';
import { EnableNotificationsBanner } from '@/components/notifications/EnableNotificationsBanner';
import FeedbackPromptsManager from '@/components/feedback/FeedbackPromptsManager';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useActivityIndicator } from '@/contexts/ActivityIndicatorContext';
import { ActivityDot } from '@/components/ActivityIndicatorDot';
import { trackEvent } from '@/lib/ga';

const navItems = [
  { href: '/dashboard/rides', icon: Search, label: 'Find a Ride' },
  { href: '/dashboard/create-ride', icon: PlusCircle, label: 'Offer a Ride' },
  { href: '/dashboard/my-rides', icon: Car, label: 'My Rides' },
  { href: '/dashboard/my-bookings', icon: User, label: 'My Bookings' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/contact', icon: Mail, label: 'Contact' },
  { href: '/dashboard/report', icon: Flag, label: 'Report' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading, data: userData, initialized } = useUser();
  const {
    hasRidesActivity,
    hasBookingsActivity,
    hasAnalyticsActivity,
    hasNotificationsActivity,
    markRidesAsViewed,
    markBookingsAsViewed,
    markAnalyticsAsViewed,
    markChatAsViewed,
    markNotificationsAsViewed,
  } = useActivityIndicator();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [layoutError, setLayoutError] = useState<string | null>(null);
  // Mark sections as viewed when navigating to them
  useEffect(() => {
    if (pathname === '/dashboard/my-rides') {
      markRidesAsViewed();
      markChatAsViewed();
    } else if (pathname === '/dashboard/my-bookings') {
      markBookingsAsViewed();
      markChatAsViewed();
    } else if (pathname === '/dashboard/analytics') {
      markAnalyticsAsViewed();
    } else if (pathname === '/dashboard/notifications') {
      markNotificationsAsViewed();
    }
  }, [
    pathname,
    markRidesAsViewed,
    markBookingsAsViewed,
    markAnalyticsAsViewed,
    markChatAsViewed,
    markNotificationsAsViewed,
  ]);

  useEffect(() => {
    if (pathname === '/dashboard/my-rides' && hasRidesActivity) {
      markRidesAsViewed();
      markChatAsViewed();
    }
    if (pathname === '/dashboard/my-bookings' && hasBookingsActivity) {
      markBookingsAsViewed();
      markChatAsViewed();
    }
    if (pathname === '/dashboard/analytics' && hasAnalyticsActivity) {
      markAnalyticsAsViewed();
    }
    if (pathname === '/dashboard/notifications' && hasNotificationsActivity) {
      markNotificationsAsViewed();
    }
  }, [
    pathname,
    hasRidesActivity,
    hasBookingsActivity,
    hasAnalyticsActivity,
    hasNotificationsActivity,
    markRidesAsViewed,
    markBookingsAsViewed,
    markAnalyticsAsViewed,
    markChatAsViewed,
    markNotificationsAsViewed,
  ]);
  // Verification enforcement is handled during sign-in/register flows.
  // Avoid route-level OTP resend/redirect loops from transient profile state.

  // Auth redirect logic - only redirect unauthenticated users to login for certain pages
  useEffect(() => {
    // Don't redirect until everything is initialized
    if (!initialized) return;
    
    // Allow logged-out users to access /dashboard/rides (public rides viewing)
    // But redirect from other dashboard pages that require authentication
    const isRidesPage = pathname === '/dashboard/rides' || pathname?.startsWith('/dashboard/rides?');
    
    // If no user and on a non-public dashboard page, redirect to select university
    if (!user && !userLoading && initialized && !isRidesPage) {
      router.replace('/auth/select-university');
      return;
    }
  }, [initialized, user, userLoading, router, pathname]);

  // ALL CONDITIONAL REDIRECTS REMOVED
  // Users always stay on dashboard after login - no redirects to select-university or complete-profile

  const handleSignOut = async () => {
    try {
      if (auth) {
        await auth.signOut();
        trackEvent('logout', {
          from_path: pathname || '/dashboard',
        });
        router.push('/');
      }
    } catch (error) {
      console.debug('[DashboardLayout] Sign out error:', error);
      setLayoutError('Failed to sign out. Please try again.');
    }
  };

  // Error state
  if (layoutError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <ErrorState
          title="Layout Error"
          description={layoutError}
          onGoHome={() => window.location.href = '/'}
        />
      </div>
    );
  }

  // For public rides page, allow rendering without user
  const isRidesPage = pathname === '/dashboard/rides' || pathname?.startsWith('/dashboard/rides?');
  
  // Loading state for non-public pages (do not hard-block on initialized)
  if (userLoading && !isRidesPage) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-64 flex-col p-4 space-y-4">
          <Logo />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </aside>
        <main className="flex-1 p-8">
          <Skeleton className="h-full w-full" />
        </main>
      </div>
    );
  }
  
  const getInitials = (name: string = '') => {
    if (!name || typeof name !== 'string') return '?';
    return name.split(' ').map(n => n[0]?? '').join('').toUpperCase().slice(0, 2);
  }

  // Ensure children arrays have stable keys to avoid React missing-key warnings
  // React.Children.toArray will normalize children and assign stable keys when needed.
  const safeChildren = React.Children.toArray(children);

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise relative">
      {/* Animated background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      </div>
      {/* Desktop Sidebar - Only show if user is logged in */}
      {user && (
      <aside className="hidden md:flex w-64 flex-col bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/80 backdrop-blur-md sticky top-0 h-screen shadow-lg shadow-primary/5">
        <div className="p-4 animate-slide-in-down">
          <Logo />
        </div>
        
        <nav className="flex-grow p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500 px-3 py-2 font-semibold">Navigation</p>
          <ul className="space-y-2">
            {navItems.map((item, idx) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href} className="animate-slide-in-left" style={{ animationDelay: `${idx * 50}ms` }}>
                  <Button
                    asChild
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 rounded-lg transition-all duration-200 group relative',
                      isActive && 'bg-gradient-to-r from-primary/25 to-accent/10 shadow-lg shadow-primary/15 text-primary',
                      !isActive && 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40'
                    )}
                  >
                    <Link href={item.href} className="flex items-center gap-3 w-full relative">
                      {/* Activity Indicator Dot for My Rides */}
                      {item.label === 'My Rides' && (
                        <div className="relative">
                          <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                          <ActivityDot show={hasRidesActivity} size={6} color="bg-primary" position="top-right" pulse={false} />
                        </div>
                      )}
                      {/* Activity Indicator Dot for My Bookings */}
                      {item.label === 'My Bookings' && (
                        <div className="relative">
                          <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                          <ActivityDot show={hasBookingsActivity} size={6} color="bg-primary" position="top-right" pulse={false} />
                        </div>
                      )}
                      {item.label === 'Analytics' && (
                        <div className="relative">
                          <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                          <ActivityDot show={hasAnalyticsActivity} size={6} color="bg-primary" position="top-right" pulse={false} />
                        </div>
                      )}
                      {item.label === 'Notifications' && (
                        <div className="relative">
                          <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                          <ActivityDot show={hasNotificationsActivity} size={6} color="bg-primary" position="top-right" pulse={false} />
                        </div>
                      )}
                      {/* Regular icon for other items */}
                      {item.label !== 'My Rides' && item.label !== 'My Bookings' && item.label !== 'Analytics' && item.label !== 'Notifications' && (
                        <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                      )}
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 space-y-3 bg-gradient-to-t from-slate-900/40 to-transparent animate-slide-up">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-lg hover:bg-slate-800/50 group text-slate-300 transition-all duration-200">
                <Avatar className="h-10 w-10 flex-shrink-0 border-2 border-primary/40 group-hover:border-primary/60 transition-all duration-200">
                  <AvatarImage src={user.photoURL ?? ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-semibold text-sm">{getInitials(userData?.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate text-sm">{userData?.fullName}</span>
                    <VerificationBadge verified={userData?.universityEmailVerified} showText={false} size="sm" />
                  </div>
                  <span className="text-xs text-slate-500 truncate">{user.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-semibold">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />                
              <DropdownMenuItem asChild className="rounded-lg">
                <Link href="/dashboard/account" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />                
              <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header - Simplified, nav moved to bottom bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40 border-b border-white/5 shadow-sm">
          <Logo />
          {user && (
          <div className="flex items-center gap-3">
            <Link href="/dashboard/notifications" className="relative p-2 rounded hover:bg-gray-700">
              <Bell className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              <ActivityDot show={hasNotificationsActivity} size={6} color="bg-primary" position="top-right" pulse={false} />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer border-2 border-primary/40 hover:border-primary/60 transition-all duration-200">
                  <AvatarImage src={user.photoURL ?? ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-semibold text-xs">{getInitials(userData?.fullName)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <span className="truncate">{userData?.fullName}</span>
                  <VerificationBadge verified={userData?.universityEmailVerified} showText={false} size="sm" />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-lg">
                  <Link href="/dashboard/account" className={cn("cursor-pointer", pathname === '/dashboard/account' && "bg-muted")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg">
                  <Link href="/dashboard/contact" className={cn("cursor-pointer", pathname === '/dashboard/contact' && "bg-muted")}>
                    <Mail className="mr-2 h-4 w-4" />
                    Contact
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg">
                  <Link href="/dashboard/report" className={cn("cursor-pointer", pathname === '/dashboard/report' && "bg-muted")}>
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-3 md:px-6 lg:px-8 py-3 md:py-6 lg:py-8 pb-24 md:pb-8 bg-transparent overflow-x-hidden">
          <EnableNotificationsBanner />
          {safeChildren.map((child, idx) => (
            <React.Fragment key={
              // preserve existing element key when available, fallback to index
              (child && typeof child === 'object' && 'key' in child && (child as any).key) ? String((child as any).key) : `dashboard-child-${idx}`
            }>
              {child}
            </React.Fragment>
          ))}
        </main>
        
        <FeedbackPromptsManager />
      </div>
      
      {/* Mobile Bottom Navigation */}
      {user && <MobileBottomNav />}
    </div>
  );
}
