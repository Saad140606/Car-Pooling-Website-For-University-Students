"use client";

import Link from "next/link";
import {
  ArrowRight,
  Flame,
  Globe2,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Lock,
  Zap,
  CheckCircle2,
  Clock,
  MessageCircle
} from "lucide-react";
import { AnimatedCard } from "@/components/AnimatedCard";
import { AnimatedButton } from "@/components/AnimatedButton";
import { Reveal } from "@/components/Reveal";
import { SiteHeader } from "@/components/SiteHeader";

const missionVision = [
  {
    title: "Mission",
    body: "Make every campus commute safe, affordable, and community-first by connecting students who look out for each other.",
    icon: <HeartHandshake className="h-6 w-6 text-primary" />,
  },
  {
    title: "Vision",
    body: "A trusted mobility layer for universities where sharing a ride feels as safe as meeting a friend on campus.",
    icon: <Target className="h-6 w-6 text-accent" />,
  },
];

const story = [
  {
    title: "The daily struggle",
    detail:
      "Long queues, costly solos, and safety worries make every commute a decision between risk and stress.",
    icon: <Flame className="h-5 w-5 text-rose-400" />,
  },
  {
    title: "The spark",
    detail:
      "Safe ride pooling with transparent profiles, gender-based preferences, and real-time checks designed for student life.",
    icon: <Sparkles className="h-5 w-5 text-primary" />,
  },
  {
    title: "The promise",
    detail:
      "You always know who you ride with, you control your comfort, and the community keeps each other safe.",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
  },
];

const portals = [
  {
    name: "FAST Portal",
    description: "Identity-verified hub for FAST students with gender-safe matching and campus-trusted profiles.",
    link: "/auth/fast/register",
    badge: "FAST NUCES",
  },
  {
    name: "NED Portal",
    description: "NED-exclusive ride network with community moderation, real-time status, and safety-first defaults.",
    link: "/auth/ned/register",
    badge: "NED UET",
  },
  {
    name: "UOK Portal",
    description: "Identity-verified hub for UOK students with gender-safe matching and campus-trusted profiles.",
    link: "/auth/karachi/register",
    badge: "UOK",
  },
];

const team = [
  { name: "Nahyan", role: "Backend Developer & Leader", university: "UIT", color: "from-primary/40 to-primary/10" },
  { name: "Saad", role: "Front End Developer & Designer", university: "FAST", color: "from-accent/40 to-accent/10" },
  { name: "Ayaan", role: "Reports & Safety Manager", university: "FAST", color: "from-emerald-500/30 to-emerald-500/10" },
  { name: "Aiman", role: "Community", university: "NED", color: "from-amber-400/30 to-amber-400/10" },
];

export default function AboutPage() {
  return (
    <div className="about-page min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <SiteHeader />
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-0 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-float" aria-hidden />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: "0.6s" }} aria-hidden />
          <div className="absolute left-1/3 top-0 h-24 w-48 rotate-6 bg-gradient-to-r from-primary/30 via-white/5 to-accent/30 blur-2xl opacity-60" aria-hidden />
        </div>

        <section className="page-shell grid min-h-[calc(50vh-4rem)] items-center gap-2 sm:gap-4 md:gap-8 pb-4 sm:pb-8 md:pb-12 pt-4 sm:pt-12 md:pt-16 lg:grid-cols-[1.05fr,0.95fr]">
          <Reveal className="space-y-4 sm:space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary animate-bounce-in">
              <Sparkles className="h-4 w-4 animate-subtle-bounce" />
              About Campus Ride
            </span>
            <h1 className="font-headline text-3xl leading-tight tracking-tight sm:text-5xl md:text-6xl animate-slide-in-down">
              Premium, safe rides designed for university campuses.
            </h1>
            <p className="max-w-2xl text-base sm:text-lg text-slate-300 animate-slide-in-down" style={{ animationDelay: "120ms" }}>
              We turn everyday commutes into trusted micro-communities with transparent profiles and a smooth, thoughtfully designed experience.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 animate-slide-in-down" style={{ animationDelay: "200ms" }}>
              <AnimatedButton asChild size="lg" className="rounded-full px-7 btn-press hover-glow">
                <Link href="/rides" className="inline-flex items-center gap-2" aria-label="Join a ride">
                  Join a ride
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </AnimatedButton>
              <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-primary/40 text-slate-200 hover:border-primary hover:text-primary">
                <Link href="/contact-us" className="inline-flex items-center gap-2" aria-label="Talk to the team">
                  Talk to the team
                  <HandHeart className="h-4 w-4" />
                </Link>
              </AnimatedButton>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-2 border border-border/40 hover:border-primary/50 transition-all duration-300 hover-card-lift">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Verified students only
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-2 border border-border/40 hover:border-primary/50 transition-all duration-300 hover-card-lift">
                  <Users className="h-4 w-4 text-primary" />
                  Community moderated
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120} className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-28 w-28 rounded-full bg-primary/25 blur-3xl animate-float" aria-hidden />
            <div className="absolute right-0 bottom-0 h-32 w-32 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: "0.4s" }} aria-hidden />
            <AnimatedCard className="relative overflow-hidden border border-primary/25 bg-gradient-to-br from-card/80 via-card/70 to-card/60 p-6 rounded-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/25 text-primary animate-scale-up">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Live ride</p>
                    <p className="text-lg font-semibold text-slate-50">FAST to NED</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary animate-pulse-glow">Trusted</span>
              </div>

              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary animate-float" />
                  Gender-safe matching enabled
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary animate-float" style={{ animationDelay: "0.2s" }} />
                  2 seats held while you decide
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400 animate-float" style={{ animationDelay: "0.4s" }} />
                  4.9 community trust score
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 hover-lift-sm hover-glow transition-all duration-300">
                  <p className="text-xs uppercase tracking-[0.15em] text-primary">For Passengers</p>
                  <p className="mt-2 font-semibold text-slate-50">Multi-request safety</p>
                  <p className="mt-1 text-sm text-slate-300">Request multiple rides, confirm who feels safest.</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 hover-lift-sm hover-glow transition-all duration-300">
                  <p className="text-xs uppercase tracking-[0.15em] text-emerald-300">For Ride Providers</p>
                  <p className="mt-2 font-semibold text-slate-50">Seat hold</p>
                  <p className="mt-1 text-sm text-slate-300">Your seats stay reserved while Passengers choose.</p>
                </div>
              </div>
            </AnimatedCard>
          </Reveal>
        </section>
      </div>

      <section className="section-shell grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <Reveal className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Mission & Vision</p>
            <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Why we exist and where we are going</h2>
            <p className="text-slate-300 max-w-2xl">Purpose built for students, not general commuters. Every decision honors safety, transparency, and the warmth of trusted community rides.</p>
          </Reveal>
          <div className="grid gap-2 sm:grid-cols-2">
            {missionVision.map((item, index) => (
              <Reveal key={item.title} delay={index * 100}>
                <AnimatedCard className="h-full border border-border/30 bg-card/70 hover:border-primary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-50">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-slate-300">{item.body}</p>
                </AnimatedCard>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={120} className="rounded-3xl border border-primary/15 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-6 shadow-2xl glass-surface">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <BookIcon />
            </div>
            <div>
              <p className="text-sm text-slate-400">Storyline</p>
              <h3 className="text-2xl font-semibold text-slate-50">Why Campus Ride exists</h3>
            </div>
          </div>
          <div className="mt-6 space-y-5">
            {story.map((item, index) => (
              <div key={item.title} className="flex gap-4 rounded-2xl border border-border/30 bg-slate-900/50 p-4 hover:border-primary/40 transition-colors duration-300">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</p>
                  <h4 className="text-lg font-semibold text-slate-50">{item.title}</h4>
                  <p className="text-slate-300">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="relative overflow-hidden py-4 sm:py-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-emerald-200/5 blur-3xl" aria-hidden />
        <div className="page-shell relative">
          <Reveal className="space-y-4 text-center mb-4 sm:mb-6 md:mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Platform Features</p>
            <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Built for trust and safety</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">Every feature is designed with student safety, convenience, and community trust at its core.</p>
          </Reveal>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { 
                icon: <ShieldCheck className="h-6 w-6 text-primary" />, 
                title: "University Verification", 
                description: "Students can verify their university email to earn a Trusted Badge. This helps others easily identify verified members within the community.",
                gradient: "from-primary/10 to-accent/5"
              },
              { 
                icon: <Lock className="h-6 w-6 text-emerald-400" />, 
                title: "Gender-Based Filtering", 
                description: "Choose rides based on your comfort preferences. Your safety and peace of mind come first.",
                gradient: "from-emerald-500/10 to-emerald-500/5"
              },
              { 
                icon: <MapPin className="h-6 w-6 text-accent" />, 
                title: "Route Map View", 
                description: "View your ride route directly inside the app with an integrated map, helping passengers and ride providers easily understand the journey.",
                gradient: "from-accent/10 to-accent/5"
              },
              { 
                icon: <Clock className="h-6 w-6 text-amber-400" />, 
                title: "Smart Scheduling", 
                description: "Post rides for any time—now or later. Flexible scheduling that matches your campus life.",
                gradient: "from-amber-400/10 to-amber-400/5"
              },
              { 
                icon: <MessageCircle className="h-6 w-6 text-blue-400" />, 
                title: "In-App Chat", 
                description: "Coordinate rides easily through in-app chat and calls. WhatsApp numbers are also shared so passengers and ride providers can communicate in the way they prefer.",
                gradient: "from-blue-500/10 to-blue-500/5"
              },
              { 
                icon: <Zap className="h-6 w-6 text-rose-400" />, 
                title: "Instant Notifications", 
                description: "Get real-time alerts for ride requests, acceptances, and updates. Never miss an opportunity.",
                gradient: "from-rose-500/10 to-rose-500/5"
              }
            ].map((feature, index) => (
              <Reveal key={feature.title} delay={index * 80}>
                <AnimatedCard 
                  animation="scale-up" 
                  hover="glow"
                  className={`border border-primary/15 bg-gradient-to-br ${feature.gradient} p-6 h-full hover:border-primary/40 transition-all duration-300`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/70 ring-1 ring-white/10">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-50">{feature.title}</h3>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{feature.description}</p>
                </AnimatedCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="mt-12">
            <div className="rounded-3xl border border-border/30 bg-slate-900/70 p-8 shadow-inner">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-50">Why Students Choose Campus Ride</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-slate-300">
                <div className="flex items-start gap-3 rounded-xl bg-slate-800/50 p-4 border border-border/30 hover:border-primary/30 transition-colors duration-300">
                  <Star className="mt-0.5 h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-200 mb-1">Cost-Effective</p>
                    <p className="text-sm">Share fuel costs and save money on daily commutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-800/50 p-4 border border-border/30 hover:border-primary/30 transition-colors duration-300">
                  <Star className="mt-0.5 h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-200 mb-1">Eco-Friendly</p>
                    <p className="text-sm">Reduce carbon footprint by sharing rides with fellow students</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-800/50 p-4 border border-border/30 hover:border-primary/30 transition-colors duration-300">
                  <Star className="mt-0.5 h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-200 mb-1">Community Building</p>
                    <p className="text-sm">Connect with peers and build lasting friendships</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-800/50 p-4 border border-border/30 hover:border-primary/30 transition-colors duration-300">
                  <Star className="mt-0.5 h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-200 mb-1">Campus-Focused</p>
                    <p className="text-sm">Designed specifically for university students and their needs</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-shell relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float" aria-hidden />
        <div className="pointer-events-none absolute right-0 bottom-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} aria-hidden />
        
        <Reveal className="space-y-4 text-center mb-8 relative z-10">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Universities We Serve</p>
          <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Active at FAST, NED & Karachi University</h2>
          <p className="text-slate-300 max-w-2xl mx-auto">Campus Rides is officially active and serving students at FAST University(Karachi), NED University, and Karachi University with equal focus and dedication.</p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto relative z-10">
          <Reveal delay={100}>
            <AnimatedCard 
              animation="scale-up"
              hover="lift"
              className="group relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/70 p-8 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/30 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary font-bold text-3xl shadow-lg">
                    F
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-50">FAST University</h3>
                    <p className="text-slate-400">Karachi Campus</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-6 text-emerald-400">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold">Active & Verified</span>
                </div>

                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm">University email verification provides Trusted Badge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm">Exclusive student community</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm">Optimized for FAST campus routes</span>
                  </div>
                </div>

                <AnimatedButton asChild className="mt-6 w-full rounded-full" size="lg">
                  <Link href="/auth/fast/register" className="inline-flex items-center justify-center gap-2">
                    Join FAST Portal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
              </div>
            </AnimatedCard>
          </Reveal>

          <Reveal delay={200}>
            <AnimatedCard 
              animation="scale-up"
              hover="lift"
              delay={1}
              className="group relative overflow-hidden border-2 border-accent/30 bg-gradient-to-br from-accent/10 via-card/80 to-card/70 p-8 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/30 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent font-bold text-3xl shadow-lg">
                    N
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-50">NED University</h3>
                    <p className="text-slate-400">Karachi Campus</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-6 text-emerald-400">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold">Active & Verified</span>
                </div>

                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <span className="text-sm">University email verification provides Trusted Badge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-accent" />
                    <span className="text-sm">Exclusive student community</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    <span className="text-sm">Optimized for NED campus routes</span>
                  </div>
                </div>

                <AnimatedButton asChild className="mt-6 w-full rounded-full" size="lg" variant="outline">
                  <Link href="/auth/ned/register" className="inline-flex items-center justify-center gap-2 border-accent/40 text-slate-200 hover:border-accent hover:bg-accent/10">
                    Join NED Portal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
              </div>
            </AnimatedCard>
          </Reveal>

          <Reveal delay={300}>
            <AnimatedCard 
              animation="scale-up"
              hover="lift"
              delay={2}
              className="group relative overflow-hidden border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-card/80 to-card/70 p-8 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 font-bold text-3xl shadow-lg">
                    K
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-50">Karachi University</h3>
                    <p className="text-slate-400">Karachi Campus</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-6 text-emerald-400">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold">Active & Verified</span>
                </div>

                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">University email verification provides Trusted Badge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">Exclusive student community</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">Optimized for Karachi University routes</span>
                  </div>
                </div>

                <AnimatedButton asChild className="mt-6 w-full rounded-full" size="lg" variant="outline">
                  <Link href="/auth/karachi/register" className="inline-flex items-center justify-center gap-2 border-purple-500/40 text-slate-200 hover:border-purple-500 hover:bg-purple-500/10">
                    Join Karachi Portal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
              </div>
            </AnimatedCard>
          </Reveal>
        </div>

        <Reveal delay={400} className="mt-8 text-center relative z-10">
          <div className="inline-block rounded-2xl border border-primary/20 bg-gradient-to-br from-card/90 to-card/70 px-8 py-6 backdrop-blur-sm">
            <p className="text-slate-300">
              <span className="font-semibold text-slate-50">Equal Focus, Equal Service:</span> All three universities receive the same level of attention, features, and support from Campus Rides.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="section-shell">
        <Reveal className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Portals</p>
          <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Dedicated, verified entry points</h2>
          <p className="max-w-2xl mx-auto text-slate-300">Each university has its own trusted gate with moderation, verification, and tailored settings.</p>
        </Reveal>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {portals.map((portal, index) => (
            <Reveal key={portal.name} delay={index * 120}>
              <AnimatedCard className="border border-primary/20 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-6 hover:border-primary/50">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">{portal.badge}</span>
                  <h3 className="text-xl font-semibold text-slate-50">{portal.name}</h3>
                </div>
                <p className="mt-3 text-slate-300">{portal.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Trusted Badges
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-emerald-200">
                    <GraduationCap className="h-4 w-4" />
                    Campus community
                  </span>
                </div>
                <AnimatedButton asChild className="mt-5 rounded-full px-6" size="lg">
                  <Link href={portal.link} className="inline-flex items-center gap-2" aria-label={`Enter ${portal.name}`}>
                    Enter portal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </AnimatedButton>
              </AnimatedCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <div className="grid gap-10 lg:grid-cols-[1fr,1fr]">
          <Reveal className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Community</p>
              <h2 className="font-headline text-3xl sm:text-4xl text-slate-50">Built with students, moderated by peers</h2>
              <p className="text-slate-300 max-w-2xl">Our community council reviews reports, refines safety rituals, and keeps the vibe respectful. Hover to feel the warmth.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
              {team.map((person, index) => (
                <div key={person.name} className="group relative overflow-hidden rounded-2xl border border-border/30 bg-slate-900/60 p-4 text-center transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${person.color} text-slate-50 font-semibold text-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}>
                    {person.name.charAt(0)}
                  </div>
                  <p className="mt-3 text-base font-semibold text-slate-50 group-hover:text-primary transition-colors duration-300">{person.name}</p>
                  <p className="text-sm text-slate-400">{person.role}</p>
                  <p className="text-xs text-slate-500">{person.university}</p>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/5 group-hover:to-accent/5 transition-all duration-500 pointer-events-none" />
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140} className="space-y-5 rounded-3xl border border-primary/20 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HandHeart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Culture</p>
                <h3 className="text-xl font-semibold text-slate-50">Trust, empathy, clarity</h3>
              </div>
            </div>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                Gentle micro-interactions that feel human—not flashy.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                Safety defaults first, preferences respected always.
              </li>
              <li className="flex items-start gap-2">
                <Globe2 className="mt-0.5 h-4 w-4 text-primary" />
                Accessibility tuned for keyboard, screen readers, and touch.
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                Clear journey storytelling so riders know what to expect.
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section-shell text-center">
        <Reveal className="relative">
          <div className="absolute -inset-10 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl opacity-30 animate-pulse-slow" aria-hidden />
          <div className="relative space-y-6 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 p-12 shadow-2xl backdrop-blur-xl hover:border-primary/50 transition-all duration-500">
            <div className="inline-block rounded-full bg-primary/20 px-4 py-2 animate-bounce-in">
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold">Ready to Join</p>
            </div>
            <h2 className="font-headline text-3xl sm:text-5xl text-slate-50 leading-tight">Join the most trusted way to move on campus</h2>
            <p className="max-w-2xl mx-auto text-lg text-slate-300">Create a ride, join a seat, or talk to us about bringing Campus Rides to your university.</p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <AnimatedButton asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300">
                <Link href="/rides" className="inline-flex items-center gap-2" aria-label="Create or join a ride">
                  Create or join a ride
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </AnimatedButton>
              <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-2 border-primary/40 text-slate-200 hover:border-primary hover:text-primary hover:bg-primary/10 hover:scale-105 transition-all duration-300">
                <Link href="/contact-us" className="inline-flex items-center gap-2" aria-label="Contact Campus Ride">
                  Contact us
                  <HandHeart className="h-4 w-4" />
                </Link>
              </AnimatedButton>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function QuoteLine({ text, name }: { text: string; name: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-800/50 p-3 border border-border/30 hover:border-primary/40 transition-colors duration-300">
      <Star className="mt-0.5 h-4 w-4 text-amber-400" />
      <div>
        <p className="text-slate-200">{text}</p>
        <p className="text-xs text-slate-400">{name}</p>
      </div>
    </div>
  );
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
      <path d="M5 4.5C5 4.22386 5.22386 4 5.5 4H12C13.933 4 15.5 5.567 15.5 7.5V19C15.5 19 14 18 12 18H5.5C5.22386 18 5 17.7761 5 17.5V4.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19 4.5C19 4.22386 18.7761 4 18.5 4H12C10.067 4 8.5 5.567 8.5 7.5V19C8.5 19 10 18 12 18H18.5C18.7761 18 19 17.7761 19 17.5V4.5Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
