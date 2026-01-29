"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, GraduationCap } from 'lucide-react';
import Logo from './logo';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { DownloadAppButton } from './premium/DownloadAppButton';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/contact-us', label: 'Contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-shadow duration-300',
        scrolled ? 'shadow-lg shadow-black/20' : 'shadow-none'
      )}
    >
      <div className="page-shell flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo />
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('nav-link', active && 'nav-link-active text-foreground')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="rounded-full px-4 relative z-10">
            <Link href="/rides">Find a Ride</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-4 relative z-10">
            <Link href="/auth/select-university">Join</Link>
          </Button>
          <DownloadAppButton variant="outline" size="sm" className="rounded-full relative z-10" />
        </div>

        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background/95 backdrop-blur">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
              </VisuallyHidden>
              <div className="mt-6 flex flex-col gap-4 text-sm font-medium text-foreground">
           
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn('nav-link text-base', active && 'nav-link-active text-foreground')}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Button asChild className="mt-2 relative z-10">
                  <Link href="/rides">Find a Ride</Link>
                </Button>
                <Button asChild variant="secondary" className="relative z-10">
                  <Link href="/auth/select-university">Join</Link>
                </Button>
                <DownloadAppButton variant="default" size="sm" className="w-full relative z-10" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
