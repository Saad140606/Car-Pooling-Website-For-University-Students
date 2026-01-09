'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Car, LogOut, PlusCircle, Search, User, Mail, Flag, Shield } from 'lucide-react';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { useAuth, useUser, useIsAdmin } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const navItems = [
  { href: '/dashboard/rides', icon: Search, label: 'Find a Ride' },
  { href: '/dashboard/create-ride', icon: PlusCircle, label: 'Offer a Ride' },
  { href: '/dashboard/my-rides', icon: Car, label: 'My Rides' },
  { href: '/dashboard/my-bookings', icon: User, label: 'My Bookings' },
  { href: '/contact-us', icon: Mail, label: 'Contact' },
  { href: '/report', icon: Flag, label: 'Report' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: userLoading, data: userData, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after auth has been initialized to avoid redirecting on transient
    // null user states caused by hot reloads / runtime errors / hydration quirks.
    if (!initialized) return; // not initialized yet

    // Add a short delay to tolerate transient null states that sometimes occur during
    // auth restoration on page refresh (prevents immediate false redirects).
    const t = setTimeout(() => {
      // Don't redirect while the user is still loading; this prevents false redirects
      // during client-side navigations where auth state may briefly be unknown.
      if (!user && !userLoading) {
        router.replace('/auth/select-university');
      }
    }, 400);

    return () => clearTimeout(t);
  }, [initialized, user, router]);

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/');
    }
  };

  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-64 flex-col border-r p-4 space-y-4">
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
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-border">
        <div className="p-4 border-b border-border">
          <Logo />
        </div>
        <nav className="flex-grow p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Button
                  asChild
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-5 w-5" />
                    {item.label}
                  </Link>
                </Button>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Button
                  asChild
                  variant={pathname === '/dashboard/admin/support' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Link href="/dashboard/admin/support">
                    <Shield className="mr-2 h-5 w-5" />
                    Admin
                  </Link>
                </Button>
              </li>
            )}
          </ul>
        </nav>
        <div className="p-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={user.photoURL ?? ''} />
                  <AvatarFallback>{getInitials(userData?.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                    <span className="font-medium">{userData?.fullName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex items-center justify-between p-4 border-b">
          <Logo />
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.photoURL ?? ''} />
                <AvatarFallback>{getInitials(userData?.fullName)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{userData?.fullName}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/account" className={cn(pathname === '/dashboard/account' && "bg-secondary")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
               {navItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                   <Link href={item.href} className={cn(pathname === item.href && "bg-secondary")}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/admin/support" className={cn(pathname === '/dashboard/admin/support' && "bg-secondary")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
