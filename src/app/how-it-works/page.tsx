import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  Car,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  UserCheck,
  Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/Reveal';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';

type Step = {
  label: string;
  title: string;
  points: string[];
  icon: JSX.Element;
  accent?: string;
};

const coreSteps: Step[] = [
  {
    label: 'Step 1',
    title: 'Request a ride',
    icon: <MapPin className="h-6 w-6" />,
    points: [
      'Choose From and To, time, and seats.',
      'Send a few requests so you stay covered and safe.',
      'Everything is student only; no outsiders.',
    ],
  },
  {
    label: 'Step 2',
    title: 'Ride Provider accepts',
    icon: <CheckCircle2 className="h-6 w-6" />,
    points: [
      'Ride providers see your request and can accept.',
      'A seat is held for you, but nothing is final yet.',
      'You get notified instantly when a ride provider responds.',
    ],
  },
  {
    label: 'Step 3',
    title: 'Seat lock & waiting',
    icon: <LockKeyhole className="h-6 w-6" />,
    points: [
      'Your seat is softly held so no one else can grab it.',
      'Prevents overbooking while you decide.',
      'Take a moment; no rush or pressure.',
    ],
  },
  {
    label: 'Step 4',
    title: 'Confirm one ride',
    icon: <ShieldCheck className="h-6 w-6" />,
    points: [
      'Pick the ride provider you like best and confirm.',
      'Other pending requests auto-cancel to stay fair.',
      'Your seat becomes permanent and everyone is notified.',
    ],
  },
];

const safetySteps: Step[] = [
  {
    label: 'Smart timer',
    title: 'If you do nothing',
    icon: <Clock3 className="h-6 w-6" />,
    points: [
      'No harsh 5-minute rule, especially for late-night or future rides.',
      'You get gentle reminders instead of surprise cancellations.',
      'We keep your spot while you figure things out.',
    ],
  },
  {
    label: 'Chat & call',
    title: 'Safe communication',
    icon: <MessageCircle className="h-6 w-6" />,
    points: [
      'Chat and calls stay inside Campus Ride, no phone numbers shared.',
      'Opens right after a ride provider accepts your request.',
      'Agree on pickup spot or quick updates without leaving the app.',
    ],
  },
  {
    label: 'Safety & fairness',
    title: 'Built for trust',
    icon: <ShieldCheck className="h-6 w-6" />,
    points: [
      'See ride provider profile, route, and planned stops before confirming.',
      'Clear cancellation options for both riders and ride providers.',
      'Rules keep things fair for everyone, no surprises.',
    ],
  },
];

function StepCard({ step, delay = '0ms', index }: { step: Step; delay?: string; index: number }) {
  return (
    <AnimatedCard
      animation="scale-up"
      hover="lift"
      delay={Math.min(index, 8) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}
      className="group relative overflow-hidden border-primary/20 bg-gradient-to-br from-card/80 to-card/60 shadow-lg hover:border-primary/40 hover:shadow-primary/30 transition-all duration-500"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:scale-150" />
      <CardHeader className="flex flex-row items-start gap-4 relative z-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/20 text-primary shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
          {step.icon}
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{step.label}</p>
          <CardTitle className="font-headline text-2xl leading-tight group-hover:text-primary transition-colors duration-300">{step.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground relative z-10">
        {step.points.map((point, idx) => (
          <div key={point} className="flex items-start gap-3 group/item hover:translate-x-1 transition-transform duration-300">
            <span className="mt-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70 group-hover/item:bg-primary group-hover/item:scale-125 transition-all duration-300 flex-shrink-0" aria-hidden />
            <p className="leading-relaxed group-hover/item:text-foreground transition-colors duration-300">{point}</p>
          </div>
        ))}
      </CardContent>
    </AnimatedCard>
  );
}

export default function HowItWorks() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <SiteHeader />

      <main className="flex-grow">
        <section className="relative overflow-hidden py-8 sm:py-12 md:py-16 lg:py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-accent/10 to-transparent" aria-hidden />
          <div className="pointer-events-none absolute left-0 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" aria-hidden />
          <div className="pointer-events-none absolute right-0 bottom-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: '1s' }} aria-hidden />
          
          <div className="container relative mx-auto grid items-center gap-6 md:gap-12 px-4 lg:grid-cols-2">
            <Reveal className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary animate-bounce-in backdrop-blur-sm">
                <Sparkles className="h-4 w-4 animate-subtle-bounce" />
                Simple, safe, student-only
              </div>
              <h1 className="font-headline text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl text-slate-50 animate-slide-in-down">
                How Campus Ride Works
              </h1>
              <p className="max-w-xl text-lg text-slate-300 animate-slide-in-down" style={{ animationDelay: '100ms' }}>
                A friendly walkthrough so first-time riders and drivers feel confident, safe, and ready to share rides across campus.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm animate-slide-in-down" style={{ animationDelay: '200ms' }}>
                <div className="inline-flex items-center gap-2 rounded-full bg-card/80 border border-border/40 px-4 py-2 backdrop-blur-sm hover:border-primary/50 hover:scale-105 transition-all duration-300">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-slate-300">Riders & drivers both win</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-card/80 border border-border/40 px-4 py-2 backdrop-blur-sm hover:border-primary/50 hover:scale-105 transition-all duration-300">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-slate-300">Built-in safety</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-card/80 border border-border/40 px-4 py-2 backdrop-blur-sm hover:border-primary/50 hover:scale-105 transition-all duration-300">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <span className="text-slate-300">Smart timer, no stress</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 animate-slide-in-down" style={{ animationDelay: '300ms' }}>
                <AnimatedButton asChild size="lg" className="rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50">
                  <Link href="/rides" className="inline-flex items-center gap-2">
                    Start a ride
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
                <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-primary/40 text-slate-200 hover:border-primary hover:bg-primary/10">
                  <Link href="/auth/select-university">Join as a student</Link>
                </AnimatedButton>
              </div>
            </Reveal>

            <Reveal delay={120} className="relative animate-fade-slide" style={{ animationDelay: '120ms' }}>
              <div className="absolute left-0 top-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="absolute -bottom-12 -right-6 h-36 w-36 rounded-full bg-accent/20 blur-3xl" aria-hidden />

              <div className="relative space-y-4 rounded-3xl border border-primary/20 bg-card/70 p-6 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Car className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Campus Ride</p>
                      <p className="text-lg font-semibold">Student Carpool</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Live</span>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    From campus gate to Library
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Seats needed: 2
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                    Requesting multiple drivers for safety
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-primary">Rider view</p>
                    <p className="mt-2 font-semibold text-foreground">Instant alerts</p>
                    <p className="mt-1">You see who accepts and pick one.</p>
                  </div>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-primary">Ride Provider view</p>
                    <p className="mt-2 font-semibold text-foreground">Seat held</p>
                    <p className="mt-1">Seat is locked softly while you decide.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden py-14 sm:py-18 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md">
          {/* Floating background orbs */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
            <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
            <div className="absolute right-0 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Story flow</p>
                <h2 className="font-headline text-3xl sm:text-4xl">From request to confirmed ride</h2>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {coreSteps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index} />
              ))}
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
              <Reveal>
                <Card className="relative overflow-hidden border-primary/25 bg-card/60 p-6 shadow-lg animate-fade-slide">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent" aria-hidden />
                <div className="relative flex flex-col gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Seat hold visual</p>
                    <h3 className="font-headline text-2xl">How the soft seat lock works</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      When a ride provider accepts, we hold your seat for a short window. Others cannot take it while you confirm. It keeps everyone safe from double-booking.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-background/60 p-4">
                    {[0, 1, 2, 3].map((seat) => (
                      <div
                        key={seat}
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border text-sm font-semibold ${
                          seat < 2 ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-card/70 text-muted-foreground'
                        }`}
                      >
                        {seat < 2 ? 'Held' : 'Open'}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Prevents overbooking while you choose
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
                      <p className="font-semibold text-foreground">For riders</p>
                      <p className="mt-1 text-muted-foreground">You get breathing room to confirm the best driver.</p>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-secondary/20 p-4 text-sm text-foreground">
                      <p className="font-semibold">For drivers</p>
                      <p className="mt-1 text-muted-foreground">Seats are protected while you wait for a rider decision.</p>
                    </div>
                  </div>
                </div>
                </Card>
              </Reveal>

              <Reveal delay={120}>
                <Card className="relative overflow-hidden border-primary/25 bg-card/60 p-6 shadow-lg animate-fade-slide" style={{ animationDelay: '120ms' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent" aria-hidden />
                <div className="relative space-y-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notifications</p>
                  <h3 className="font-headline text-2xl">Instant but calm alerts</h3>
                  <p className="text-sm text-muted-foreground">You are notified right away when drivers accept, when seats are held, and when a confirmation is needed without spam.</p>
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background/60 p-3">
                      <BellRing className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">Ride Provider accepted</p>
                        <p>We mark the seat as held and let you know instantly.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background/60 p-3">
                      <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">Friendly reminder</p>
                        <p>No auto-cancel for future rides; just gentle nudges so you remember to confirm.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-14 sm:py-18 bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-slate-950/80 backdrop-blur-md">
          {/* Floating background orbs */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/15 via-transparent to-transparent" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl opacity-30 animate-float" />
            <div className="absolute -left-40 bottom-20 h-80 w-80 rounded-full bg-primary/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }} />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">After acceptance</p>
                <h2 className="font-headline text-3xl sm:text-4xl">Smart timer, chat, and fairness</h2>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {safetySteps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index} />
              ))}
            </div>

            <div className="mt-8 sm:mt-12 grid gap-6 md:grid-cols-[1.1fr,0.9fr]\">
              <Reveal>
                <Card className="relative overflow-hidden border-primary/25 bg-background/70 p-6 shadow-lg animate-fade-slide">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent" aria-hidden />
                <div className="relative flex flex-col gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chat & call</p>
                  <h3 className="font-headline text-2xl">Talk safely inside the app</h3>
                  <p className="text-sm text-muted-foreground">Share details without exposing phone numbers. Drivers and riders can coordinate pickup spots and timing as soon as an acceptance happens.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/70 p-3 text-sm text-muted-foreground">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">Chat bubbles</p>
                        <p>Quick updates on where to meet.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/70 p-3 text-sm text-muted-foreground">
                      <PhoneCall className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">In-app calls</p>
                        <p>Call without sharing personal numbers.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              </Reveal>

              <Reveal delay={120}>
                <Card className="relative overflow-hidden border-primary/25 bg-background/70 p-6 shadow-lg animate-fade-slide" style={{ animationDelay: '120ms' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-primary/10 to-transparent" aria-hidden />
                <div className="relative flex flex-col gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fair for everyone</p>
                  <h3 className="font-headline text-2xl">Clear, student-friendly rules</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />
                      Ride provider profile, route, and stops are visible before you confirm.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />
                      You can cancel easily if plans change, and ride providers can release a seat when needed.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />
                      Confirmation locks one ride and frees the rest, fair for riders and ride providers.
                    </li>
                  </ul>
                </div>
              </Card>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-14 sm:py-18 bg-gradient-to-br from-slate-900/50 via-slate-950/70 to-slate-900/50 backdrop-blur-md">
          {/* Floating background orbs */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-accent/10" />
            <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute -right-40 bottom-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '1.5s' }} />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">One clear flow</p>
                <h2 className="font-headline text-3xl sm:text-4xl">Ride steps at a glance</h2>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-3xl border border-primary/25 bg-card/60 p-6 text-sm font-semibold text-foreground shadow-lg animate-fade-slide">
              <FlowChip label="Request" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowChip label="Accept" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowChip label="Seat hold" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowChip label="Confirm" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowChip label="Ride" />
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Reveal>
                <Card className="border-primary/25 bg-card/60 p-6 shadow-lg animate-fade-slide">
                <h3 className="font-headline text-2xl">For riders</h3>
                <p className="mt-2 text-sm text-muted-foreground">Stay covered by requesting multiple drivers, then confirm the one that feels best.</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Soft seat lock keeps your spot.</li>
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Smart timer means no sudden auto-cancels for future rides.</li>
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Chat and call safely after acceptance.</li>
                </ul>
                </Card>
              </Reveal>
              <Reveal delay={120}>
                <Card className="border-primary/25 bg-card/60 p-6 shadow-lg animate-fade-slide" style={{ animationDelay: '120ms' }}>
                <h3 className="font-headline text-2xl">For drivers</h3>
                <p className="mt-2 text-sm text-muted-foreground">Accept requests, hold a seat, and let riders confirm. Fair for your time and fuel.</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Seat hold stops overbooking while riders decide.</li>
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Clear confirmations so you know exactly who is riding.</li>
                  <li className="flex items-start gap-2"><span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />Cancel easily if plans change before a rider confirms.</li>
                </ul>
                </Card>
              </Reveal>
            </div>

            <div className="mt-8 sm:mt-12 relative">
              <div className="absolute -inset-6 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl opacity-30 animate-pulse-slow" aria-hidden />
              <div className="relative flex flex-wrap items-center justify-between gap-4 sm:gap-6 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex-1">
                  <h3 className="font-headline text-3xl text-slate-50">Ready to try it?</h3>
                  <p className="mt-2 text-slate-300 max-w-xl">Request a ride, see who accepts, lock a seat, and confirm when you are sure.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <AnimatedButton asChild size="lg" className="rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50">
                    <Link href="/rides" className="inline-flex items-center gap-2">
                      Find a ride
                      <Route className="h-4 w-4" />
                    </Link>
                  </AnimatedButton>
                  <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-primary/40 text-slate-200 hover:border-primary hover:bg-primary/10">
                    <Link href="/auth/select-university">Offer a ride</Link>
                  </AnimatedButton>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FlowChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/60 px-4 py-2 text-sm text-foreground shadow-sm">
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
      {label}
    </span>
  );
}
