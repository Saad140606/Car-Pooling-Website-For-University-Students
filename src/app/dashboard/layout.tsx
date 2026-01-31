'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Car, LogOut, PlusCircle, Search, User, Mail, Flag, Shield, AlertTriangle, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { useAuth, useUser, useIsAdmin } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VerificationBadge } from '@/components/VerificationBadge';
import { useNotifications } from '@/contexts/NotificationContext';
import NotificationBadge from '@/components/NotificationBadge';
import { ErrorState } from '@/components/StateComponents';

const navItems = [
  { href: '/dashboard/rides', icon: Search, label: 'Find a Ride' },
  { href: '/dashboard/create-ride', icon: PlusCircle, label: 'Offer a Ride' },
  { href: '/dashboard/my-rides', icon: Car, label: 'My Rides' },
  { href: '/dashboard/my-bookings', icon: User, label: 'My Bookings' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/contact', icon: Mail, label: 'Contact' },
  { href: '/dashboard/report', icon: Flag, label: 'Report' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading, data: userData, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { unreadCount } = useNotifications();
  const auth = useAuth();
  const router = useRouter();
  const [layoutError, setLayoutError] = useState<string | null>(null);

  // Check if current route is an admin route
  const isAdminRoute = pathname?.startsWith('/dashboard/admin');

  // CRITICAL: Unified auth redirect logic with admin bypass
  useEffect(() => {
    // Don't redirect until everything is initialized
    if (!initialized) return;
    
    // For admin routes: wait for admin check to complete
    if (isAdminRoute && adminLoading) return;
    
    // For admin routes: if user is confirmed admin, allow access
    if (isAdminRoute && isAdmin && user) {
      return;
    }
    
    // For admin routes: if not admin and check is complete, redirect to login
    if (isAdminRoute && !adminLoading && !isAdmin) {
      router.replace('/auth/select-university');
      return;
    }
    
    // For non-admin routes: check if user is logged in
    if (!isAdminRoute && !user && !userLoading && initialized) {
      router.replace('/auth/select-university');
      return;
    }
  }, [initialized, user, userLoading, isAdmin, adminLoading, isAdminRoute, router]);

  // CRITICAL: University requirement bypass for admins (only for non-admin routes)
  useEffect(() => {
    if (!user || !initialized) return;
    
    // Admin users bypass ALL requirements
    if (isAdmin) return;
    
    // If still checking admin status, don't redirect yet
    if (adminLoading) return;
    
    // Non-admin users must have university selected (except admin routes)
    if (!isAdminRoute && !userData?.university && !userLoading) {
      router.replace('/auth/select-university');
      return;
    }
  }, [user, initialized, isAdmin, adminLoading, userData?.university, userLoading, isAdminRoute, router]);

  const handleSignOut = async () => {
    try {
      if (auth) {
        await auth.signOut();
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

  // Loading state
  if (userLoading || !user) {
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

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise relative">
      {/* Animated background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      </div>
      {/* Desktop Sidebar */}
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
                      'w-full justify-start gap-3 rounded-lg transition-all duration-200 group',
                      isActive && 'bg-gradient-to-r from-primary/25 to-accent/10 shadow-lg shadow-primary/15 text-primary',
                      !isActive && 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40'
                    )}
                  >
                    <Link href={item.href} className="flex items-center gap-3 w-full relative">
                      <item.icon className={cn('h-5 w-5 transition-all duration-300', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary')} />
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
                      {item.label === 'My Rides' && unreadCount.total > 0 && (
                        <NotificationBadge count={unreadCount.ride_status + unreadCount.booking} dot className="ml-auto" position="inline" />
                      )}
                      {item.label === 'My Bookings' && unreadCount.total > 0 && (
                        <NotificationBadge count={unreadCount.booking + unreadCount.chat} dot className="ml-auto" position="inline" />
                      )}
                    </Link>
                  </Button>
                </li>
              );
            })}
            {isAdmin && (
              <li className="animate-slide-in-left" style={{ animationDelay: `${navItems.length * 50}ms` }}>
                <Button
                  asChild
                  variant={pathname?.startsWith('/dashboard/admin') ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 rounded-lg transition-all duration-200 group',
                    pathname?.startsWith('/dashboard/admin') && 'bg-gradient-to-r from-primary/25 to-accent/10 shadow-lg shadow-primary/15 text-primary',
                    !pathname?.startsWith('/dashboard/admin') && 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40'
                  )}
                >
                  <Link href="/dashboard/admin" className="flex items-center gap-3 w-full">
                    <Shield className="h-5 w-5 text-slate-400 group-hover:text-primary transition-all duration-300" />
                    <span className="font-medium">Admin Panel</span>
                  </Link>
                </Button>
              </li>
            )}
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

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80 backdrop-blur-md sticky top-0 z-40 animate-slide-down shadow-lg shadow-primary/5">
          <Logo />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-10 w-10 cursor-pointer border-2 border-primary/40 hover:border-primary/60 transition-all duration-200">
                <AvatarImage src={user.photoURL ?? ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-semibold text-sm">{getInitials(userData?.fullName)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuLabel className="flex items-center gap-2">
                <span>{userData?.fullName}</span>
                <VerificationBadge verified={userData?.universityEmailVerified} showText={false} size="sm" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg">
                <Link href="/dashboard/account" className={cn("cursor-pointer", pathname === '/dashboard/account' && "bg-muted")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {navItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild className="rounded-lg">
                  <Link href={item.href} className={cn("cursor-pointer relative", pathname === item.href && "bg-muted")}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                    {item.label === 'My Rides' && unreadCount.total > 0 && (
                      <NotificationBadge count={unreadCount.ride_status + unreadCount.booking} dot className="ml-auto" position="inline" />
                    )}
                    {item.label === 'My Bookings' && unreadCount.total > 0 && (
                      <NotificationBadge count={unreadCount.booking + unreadCount.chat} dot className="ml-auto" position="inline" />
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
              {isAdmin && (
                <DropdownMenuItem asChild className="rounded-lg">
                  <Link href="/dashboard/admin" className={cn("cursor-pointer", pathname?.startsWith('/dashboard/admin') && "bg-muted")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 bg-transparent overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
