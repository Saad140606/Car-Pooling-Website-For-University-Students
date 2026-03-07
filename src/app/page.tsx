import type { Metadata } from 'next';
import Link from 'next/link';
import { Car, ShieldCheck, Users, ArrowRight, Sparkles, Waves, Zap, Heart, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/Reveal';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { RootPageGuard } from '@/components/RootPageGuard';
import { buildSeoMetadata, SEO_TARGET_KEYWORDS, SITE_URL } from '@/config/seo';

export const metadata: Metadata = buildSeoMetadata('/');

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Campus Rides',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/rides`,
      'query-input': 'required name=search_term_string',
    },
    keywords: SEO_TARGET_KEYWORDS.join(', '),
  };

  const features = [
    {
      icon: <Car className="h-10 w-10 text-accent" />,
      title: 'University-Only Rides',
      description: 'Share rides exclusively with students and faculty from your university.',
    },
    {
      icon: <ShieldCheck className="h-10 w-10 text-accent" />,
      title: 'Safety First',
      description: 'Gender-based filtering, real-time notifications, and user reporting for a secure journey.',
    },
    {
      icon: <Users className="h-10 w-10 text-accent" />,
      title: 'Community Driven',
      description: 'Connect with fellow university members, save money, and reduce your carbon footprint.',
    },
  ];

  return (
    <RootPageGuard>
      <div className="flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />
      <main className="flex-grow">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
          <div className="absolute -right-40 -bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />
          <div className="absolute left-1/2 top-20 h-24 w-96 -translate-x-1/2 rotate-12 bg-gradient-to-r from-primary/20 via-white/5 to-accent/20 blur-2xl" aria-hidden />
          <div className="page-shell grid min-h-[50vh] sm:min-h-[65vh] items-center gap-6 md:gap-12 py-8 sm:py-12 md:py-16 lg:grid-cols-[1.1fr,0.9fr]">
            <Reveal className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary animate-bounce-in backdrop-blur-sm shadow-lg shadow-primary/20">
                <Sparkles className="h-4 w-4 animate-subtle-bounce" />
                Student-first carpooling
              </div>
              <h1 className="font-headline text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl text-slate-50 animate-slide-in-down bg-gradient-to-br from-slate-50 via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Campus Rides — Your University Carpooling Platform
              </h1>
              <p className="max-w-2xl text-lg text-slate-300 animate-slide-in-down leading-relaxed" style={{ animationDelay: '100ms' }}>
                Safe, student-only carpooling platform. Find or offer rides within your trusted campus community.
              </p>
              <div className="flex flex-wrap items-center gap-4 animate-slide-in-down" style={{ animationDelay: '150ms' }}>
                <AnimatedButton asChild size="xl" className="rounded-full px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300">
                  <Link href="/rides" className="inline-flex items-center gap-2" aria-label="Find a Ride">
                    Find a ride
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </AnimatedButton>
                <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-2 border-primary/40 text-slate-200 hover:border-primary hover:bg-primary/10">
                  <Link href="/auth/select-university" className="inline-flex items-center gap-2" aria-label="Get Started">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm animate-slide-in-down" style={{ animationDelay: '300ms' }}>
                <span className="inline-flex items-center gap-2 rounded-full bg-card/80 backdrop-blur px-3 py-2.5 border border-border/40 hover:border-primary/50 hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Safety-first
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-card/80 backdrop-blur px-3 py-2.5 border border-border/40 hover:border-primary/50 hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 text-slate-300">
                  <Users className="h-4 w-4 text-primary" /> Students only
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-card/80 backdrop-blur px-3 py-2.5 border border-border/40 hover:border-primary/50 hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 text-slate-300">
                  <Zap className="h-4 w-4 text-primary" /> Real rides, real savings
                </span>
              </div>
            </Reveal>

            <Reveal delay={120} className="relative">
              <div className="absolute left-0 top-0 h-28 w-28 rounded-full bg-primary/25 blur-3xl animate-float" aria-hidden />
              <div className="absolute right-0 bottom-0 h-32 w-32 rounded-full bg-accent/25 blur-3xl animate-float" style={{ animationDelay: '0.5s' }} aria-hidden />
              <div className="relative rounded-3xl border border-primary/20 bg-card/70 p-6 shadow-2xl backdrop-blur glass-surface soft-shadow hover-card-lift animate-bounce-in transition-all duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary animate-scale-up">
                      <Car className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Campus Rides</p>
                      <p className="text-lg font-semibold text-foreground">Find your ride, share the journey</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary animate-pulse-glow">Live</span>
                </div>

                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                    <Waves className="h-4 w-4 text-primary animate-float" />
                    Real-time availability
                  </div>
                  <div className="flex items-center gap-2 animate-slide-in-left" style={{ animationDelay: '300ms' }}>
                    <ShieldCheck className="h-4 w-4 text-primary animate-float" style={{ animationDelay: '0.3s' }} />
                    Verified students only
                  </div>
                  <div className="flex items-center gap-2 animate-slide-in-left" style={{ animationDelay: '400ms' }}>
                    <Users className="h-4 w-4 text-primary animate-float" style={{ animationDelay: '0.6s' }} />
                    Up to 3 seats left
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 hover-lift-sm hover-glow transition-all duration-300 cursor-pointer animate-flip-in" style={{ animationDelay: '600ms' }}>
                    <p className="text-xs uppercase tracking-[0.15em] text-primary">Passenger view</p>
                    <p className="mt-2 font-semibold text-foreground">Instant alerts</p>
                    <p className="mt-1 text-sm text-muted-foreground">See accepts fast, confirm the best match.</p>
                  </div>
                  <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 hover-lift-sm hover-glow transition-all duration-300 cursor-pointer animate-flip-in" style={{ animationDelay: '700ms' }}>
                    <p className="text-xs uppercase tracking-[0.15em] text-primary">Ride Provider view</p>
                    <p className="mt-2 font-semibold text-foreground">Seat hold</p>
                    <p className="mt-1 text-sm text-muted-foreground">No overbooking while passengers decide.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="features" className="section-shell relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent blur-3xl" aria-hidden />
          <Reveal className="text-center space-y-4 relative z-10">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Why Campus Ride</p>
            <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Built for students who want safe rides</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">Request multiple rides for safety, chat inside the app, and confirm the ride provider you trust most.</p>
          </Reveal>
          <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3 relative z-10">
            {features.map((feature, index) => (
              <AnimatedCard 
                key={feature.title}
                animation="scale-up"
                hover="glow"
                delay={(index * 100) as 0 | 100 | 200 | 300}
                className="bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-lg border-2 border-primary/20 text-center transition-all duration-500 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 group cursor-pointer"
              >
                <CardHeader>
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/20 shadow-lg group-hover:from-primary/35 group-hover:to-accent/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    <div className="group-hover:animate-subtle-bounce">
                      {feature.icon}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="font-headline text-2xl text-slate-50 group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                  <p className="mt-3 text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">{feature.description}</p>
                </CardContent>
              </AnimatedCard>
            ))}
          </div>
        </section>

        <section className="section-shell relative overflow-hidden bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
          <div className="pointer-events-none absolute left-0 top-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl animate-float" aria-hidden />
          <div className="pointer-events-none absolute right-0 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} aria-hidden />
          
          <Reveal className="relative z-10">
            <div className="text-center space-y-4 mb-6 sm:mb-8 md:mb-12\">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">What makes us different</p>
              <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Trusted by your campus community</h2>
              <p className="text-slate-300 max-w-2xl mx-auto">Join students who choose Campus Rides for safe, affordable, and reliable commutes every day.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
              {[
                { icon: <ShieldCheck className="h-8 w-8" />, title: "Verified Students", desc: "University students can verify their official email to receive a trusted verification badge that highlights authentic student profiles." },
                { icon: <Heart className="h-8 w-8" />, title: "Community First", desc: "Built by students, for students. Your safety and comfort matter most" },
                { icon: <MapPin className="h-8 w-8" />, title: "Campus Routes", desc: "Optimized for university locations with smooth and reliable route navigation." }
              ].map((item, idx) => (
                <AnimatedCard
                  key={item.title}
                  animation="scale-up"
                  delay={(idx * 100) as 0 | 100 | 200}
                  hover="lift"
                  className="border border-primary/20 bg-gradient-to-br from-card/90 to-card/70 p-6 text-center backdrop-blur-sm hover:border-primary/40 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                >
                  <div className="flex justify-center mb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-50 mb-2">{item.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                </AnimatedCard>
              ))}
            </div>

            <div className="mt-16 text-center">
              <div className="relative inline-block">
                <div className="absolute -inset-6 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-2xl opacity-30 animate-pulse-slow" aria-hidden />
                <div className="relative rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card/90 to-accent/10 p-8 backdrop-blur-xl shadow-2xl">
                  <h3 className="font-headline text-2xl sm:text-3xl text-slate-50 mb-4">Ready to ride with us?</h3>
                  <p className="text-slate-300 mb-6 max-w-lg mx-auto">Join your campus community and start carpooling the smart way.</p>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <AnimatedButton asChild size="lg" className="rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50">
                      <Link href="/rides" className="inline-flex items-center gap-2">
                        Browse rides
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </AnimatedButton>
                    <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-2 border-primary/40 text-slate-200 hover:border-primary hover:bg-primary/10">
                      <Link href="/about">Learn more</Link>
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <footer className="w-full py-8 sm:py-12 md:py-16 border-t border-primary/20 bg-gradient-to-b from-slate-900/40 via-slate-950/60 to-black backdrop-blur-xl animate-page-rise" style={{ animationDelay: '600ms' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 sm:mb-12">
            {/* Brand Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xl font-headline font-bold text-slate-50">Campus Rides</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">Join your campus community and start carpooling the smart way. Safe, affordable, and eco-friendly rides for university students.Available for FAST National University (Karachi), NED University of Engineering and Technology, and University of Karachi</p>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-50 uppercase tracking-wider">Quick Links</h3>
              <div className="flex flex-col space-y-3">
                <Link href="/how-it-works" className="text-sm text-slate-400 hover:text-primary transition-all duration-200 flex items-center gap-2 group">
                  <span className="inline-block transform group-hover:translate-x-1 transition-transform">→</span>
                  How It Works
                </Link>
                <Link href="/about" className="text-sm text-slate-400 hover:text-primary transition-all duration-200 flex items-center gap-2 group">
                  <span className="inline-block transform group-hover:translate-x-1 transition-transform">→</span>
                  About Us
                </Link>
                <Link href="/terms" className="text-sm text-slate-400 hover:text-primary transition-all duration-200 flex items-center gap-2 group">
                  <span className="inline-block transform group-hover:translate-x-1 transition-transform">→</span>
                  Terms & Conditions
                </Link>
              </div>
            </div>

            {/* Contact & Support */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-50 uppercase tracking-wider">Support</h3>
              <div className="flex flex-col space-y-3">
                <Link href="/contact-us" className="text-sm text-slate-400 hover:text-primary transition-all duration-200 flex items-center gap-2 group">
                  <span className="inline-block transform group-hover:translate-x-1 transition-transform">→</span>
                  Contact Us
                </Link>
                <Link href="/report" className="text-sm text-slate-400 hover:text-primary transition-all duration-200 flex items-center gap-2 group">
                  <span className="inline-block transform group-hover:translate-x-1 transition-transform">→</span>
                  Report an Issue
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-800/50">
            <div className="flex items-center justify-center">
              <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Campus Rides. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </RootPageGuard>
  );
}
