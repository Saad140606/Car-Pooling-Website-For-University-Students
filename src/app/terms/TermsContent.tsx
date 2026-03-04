"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileCheck,
  Flag,
  Gavel,
  Info,
  KeyRound,
  Link as LinkIcon,
  Lock,
  MapPin,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldCheck,
  ShieldHalf,
  Smartphone,
} from "lucide-react";
import { AnimatedButton } from "@/components/AnimatedButton";
import { AnimatedCard } from "@/components/AnimatedCard";
import { Reveal } from "@/components/Reveal";

// Section definitions for both Terms and Privacy tabs
// Icons and content are kept inline for clarity; consider sourcing from CMS if policies change often.
type PolicySection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  icon: React.ReactNode;
  tone?: "warning" | "info";
  footnote?: string;
};

const termsSections: PolicySection[] = [
  {
    id: "platform-overview",
    title: "Platform Overview",
    summary: "Campus Ride facilitates voluntary ride sharing between verified students and faculty at participating universities.",
    bullets: [
      "Campus-exclusive network; not a commercial transport provider",
      "Facilitates ride discovery, coordination, and respectful communication",
      "Community standards align with university ethics and honor codes",
    ],
    icon: <ScrollText className="h-5 w-5 text-primary" />,
  },
  {
    id: "user-responsibilities",
    title: "User Responsibilities",
    summary: "Accounts are personal. Provide truthful academic identity and keep details updated.",
    bullets: [
      "One account per individual; credentials must not be shared",
      "Profile accuracy (name, university, gender preferences) is required",
      "Respectful, non-discriminatory conduct on chats and rides",
    ],
    icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
  },
  {
    id: "ride-rules",
    title: "Ride Rules & Conduct",
    summary: "Ride creation and acceptance stay transparent with mutual consent as the baseline.",
    bullets: [
      "Ride details must stay accurate (time, route, seats, preferences)",
      "Gender filters and trust scores guide safer matches; honor them",
      "Arrive on time; repeated no-shows may be reviewed",
    ],
    icon: <FileCheck className="h-5 w-5 text-primary" />,
  },
  {
    id: "cancellation-lock-policy",
    title: "Cancellation & Account Lock Policy",
    summary: "Frequent late cancellations are tracked. Repeated policy violations can temporarily lock ride actions.",
    bullets: [
      "Driver and passenger cancellation rates are monitored as trust and reliability signals",
      "Cancellation warnings may appear before lock thresholds are reached",
      "Policy-triggered locks can block creating, booking, or managing rides until lock expiry",
    ],
    icon: <AlertTriangle className="h-5 w-5 text-amber-300" />,
    tone: "warning",
  },
  {
    id: "safety-guidelines",
    title: "Safety Guidelines",
    summary: "Safety is shared. Verify riders, choose trusted options, and keep communication inside the app.",
    bullets: [
      "Use in-app chat only; avoid off-platform payments or links",
      "Share rides only with verified campus members and respect seat holds",
      "Report concerns immediately; urgent risks should be escalated to authorities",
    ],
    icon: <ShieldHalf className="h-5 w-5 text-amber-300" />,
    tone: "warning",
    footnote: "Campus Ride is a facilitator, not a transporter. You are responsible for your personal judgment and belongings.",
  },
  {
    id: "reports-violations",
    title: "Reports & Violations",
    summary: "Good-faith reports protect everyone; malicious reports harm trust and are prohibited.",
    bullets: [
      "Use the in-app report flow for harassment, safety, or fraud concerns",
      "Provide factual context; false or retaliatory reports may lead to suspension",
      "Serious risks may be escalated to university administration when necessary",
    ],
    icon: <Flag className="h-5 w-5 text-rose-400" />,
  },
  {
    id: "account-suspension",
    title: "Account Suspension / Termination",
    summary: "We may pause or terminate accounts to protect community integrity without prior notice when risk is detected.",
    bullets: [
      "Violation of safety, conduct, or authenticity triggers review",
      "Repeated cancellations, policy evasion, or lock circumvention may result in suspension",
      "Appeals can be submitted through support with context",
    ],
    icon: <Gavel className="h-5 w-5 text-primary" />,
  },
  {
    id: "platform-limitations",
    title: "Platform Limitations",
    summary: "We do not own vehicles, guarantee punctuality, or act as employer/agent. Participation is voluntary.",
    bullets: [
      "No guarantee of ride availability, timing, or road safety",
      "Platform may pause for maintenance or security; expect occasional downtime",
      "Liability for travel, belongings, and decisions rests with the user",
    ],
    icon: <Shield className="h-5 w-5 text-slate-200" />,
  },
  {
    id: "policy-updates",
    title: "Policy Updates",
    summary: "We may update terms. Continued use means acceptance of the latest version.",
    bullets: [
      "Notice is shared in-app for meaningful changes",
      "Review updates before continuing to use the platform",
      "Archived versions are available upon request",
    ],
    icon: <RefreshCw className="h-5 w-5 text-primary" />,
  },
];

const privacySections: PolicySection[] = [
  {
    id: "data-we-collect",
    title: "Data We Collect",
    summary: "Identity, academic affiliation, ride details, device identifiers, and interaction logs for safety and reliability.",
    bullets: [
      "Name, university email/ID, gender preferences, and verification artifacts",
      "Ride metadata (routes, timings, seats) and in-app interactions",
      "Device data (app version, IP, basic diagnostics) for security",
    ],
    icon: <Database className="h-5 w-5 text-primary" />,
  },
  {
    id: "data-usage",
    title: "How Data Is Used",
    summary: "Enable matching, safety checks, integrity monitoring, and service improvements.",
    bullets: [
      "Verify eligibility and enforce community safeguards",
      "Surface trust signals (badges, gender filters, cancellation history, lock status)",
      "Improve reliability through analytics and incident prevention",
    ],
    icon: <BarChart3 className="h-5 w-5 text-emerald-400" />,
  },
  {
    id: "ride-location",
    title: "Ride & Location Data",
    summary: "Location is used only to power ride relevance, matching, and safety insights—never sold.",
    bullets: [
      "Location checks are limited to ride creation, search, and status",
      "Shared only with relevant parties in the active ride context",
      "You can manage device-level permissions at any time",
    ],
    icon: <MapPin className="h-5 w-5 text-primary" />,
  },
  {
    id: "cookies-analytics",
    title: "Cookies & Analytics",
    summary: "Lightweight analytics improve stability; tracking is minimal and never third-party advertising based.",
    bullets: [
      "Essential cookies keep you signed in and secure",
      "Analytics are aggregated; no sale of personal data",
      "You may clear cookies; functionality may be reduced",
    ],
    icon: <Smartphone className="h-5 w-5 text-amber-300" />,
    tone: "info",
  },
  {
    id: "data-sharing",
    title: "Data Sharing & Protection",
    summary: "Shared narrowly with active ride participants or when legally required. We use safeguards and access controls.",
    bullets: [
      "No selling of personal data; no advertising brokers",
      "Role-based access, encryption in transit, and monitored logs",
      "Disclosures happen when lawfully required or to protect safety",
    ],
    icon: <Lock className="h-5 w-5 text-primary" />,
  },
  {
    id: "user-rights",
    title: "User Rights & Control",
    summary: "You can access, update, or request deletion of your data unless retention is required by law or safety investigations.",
    bullets: [
      "Profile edits are available in settings; verification re-checks may apply",
      "Deletion requests are honored where lawful; some logs may be retained for safety",
      "Contact support for data access or export requests",
    ],
    icon: <KeyRound className="h-5 w-5 text-emerald-400" />,
  },
  {
    id: "data-retention",
    title: "Data Retention",
    summary: "Data is kept only as long as necessary for safety, legal, or operational obligations.",
    bullets: [
      "Ride and incident logs retained for audit and abuse prevention",
      "Cancellation-rate and lock-policy records may be retained for enforcement and dispute review",
      "Backups cycle out on a schedule; sensitive data minimized",
      "Retention timelines may extend for legal or dispute resolution",
    ],
    icon: <ShieldHalf className="h-5 w-5 text-primary" />,
  },
  {
    id: "privacy-updates",
    title: "Policy Updates",
    summary: "Privacy terms may evolve. We will notify you and highlight meaningful changes.",
    bullets: [
      "Version date and change log shared in-app",
      "Continued use signifies consent to updated terms",
      "You may reach out with questions before continuing",
    ],
    icon: <RefreshCw className="h-5 w-5 text-primary" />,
  },
];

export default function TermsContent() {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");
  const sections = useMemo(() => (activeTab === "terms" ? termsSections : privacySections), [activeTab]);
  const [activeSection, setActiveSection] = useState(`${activeTab}-${sections[0].id}`);
  const [progress, setProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const scrolled = Math.max(0, window.scrollY);
      setProgress(scrollable > 0 ? Math.min(100, (scrolled / scrollable) * 100) : 0);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const ids = sections.map((section) => `${activeTab}-${section.id}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.2, 0.4] }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections, activeTab]);

  useEffect(() => {
    setActiveSection(`${activeTab}-${sections[0].id}`);
  }, [activeTab, sections]);

  const copyLink = (domId: string) => {
    const url = `${window.location.origin}/terms#${domId}`;
    navigator?.clipboard?.writeText(url).then(() => {
      setCopiedId(domId);
      setTimeout(() => setCopiedId(null), 1600);
    }).catch(() => setCopiedId(domId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-slate-800/60">
        <div className="h-full bg-gradient-to-r from-primary via-accent to-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} aria-hidden />
      </div>

      <section className="page-shell pt-16 pb-10 sm:pt-20">
        <Reveal className="space-y-4 text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary animate-bounce-in">
            <BookOpenCheck className="h-4 w-4" />
            Terms & Privacy
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl leading-tight text-slate-50 animate-slide-in-down">
            Clear, human, and premium legal experience.
          </h1>
          <p className="text-lg text-slate-300 animate-slide-in-down" style={{ animationDelay: "120ms" }}>
            Two connected policies in one modern hub. Built for readability, trust, and quick navigation without feeling intimidating.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400 animate-slide-in-down" style={{ animationDelay: "220ms" }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-2 border border-border/40">
              <ShieldCheck className="h-4 w-4 text-primary" /> Campus-only safety layer
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-2 border border-border/40">
              <Lock className="h-4 w-4 text-primary" /> Privacy-first defaults
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-2 border border-border/40">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Keyboard & screen-reader friendly
            </span>
          </div>
          <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-primary/30 bg-slate-900/60 px-4 py-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 font-semibold">
              <Info className="h-4 w-4" /> Last updated: 10 Jan 2026
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary font-semibold animate-pulse-glow">
              Effective: 1 Jan 2026
            </span>
          </div>
        </Reveal>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3" role="tablist" aria-label="Legal content tabs">
          {[
            { id: "terms", label: "Terms & Regulations", icon: <ScrollText className="h-4 w-4" /> },
            { id: "privacy", label: "Privacy Policy", icon: <Lock className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as "terms" | "privacy")}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                activeTab === tab.id
                  ? "border-primary/60 bg-primary/10 text-primary shadow-lg shadow-primary/20"
                  : "border-border/40 bg-slate-900/60 text-slate-300 hover:border-primary/40"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="page-shell grid gap-8 pb-16 md:grid-cols-[280px,1fr]">
        <aside className="hidden md:block sticky top-28 h-min rounded-2xl border border-primary/15 bg-slate-900/70 p-4 shadow-xl backdrop-blur-lg">
          <p className="text-sm font-semibold text-slate-200 mb-3">On this page</p>
          <nav className="space-y-2 text-sm" aria-label="Table of contents">
            {sections.map((section) => {
              const domId = `${activeTab}-${section.id}`;
              const isActive = activeSection === domId;
              return (
                <a
                  key={domId}
                  href={`#${domId}`}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/40 shadow-sm"
                      : "text-slate-300 hover:text-primary hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                  <span>{section.title}</span>
                </a>
              );
            })}
          </nav>
          <div className="mt-4 rounded-xl border border-border/30 bg-slate-800/60 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Need clarity?</p>
            <p className="mt-1">Reach out and we will guide you through the policies.</p>
            <AnimatedButton asChild variant="outline" size="sm" className="mt-3 w-full justify-center rounded-full border-primary/40 text-primary">
              <Link href="/contact-us" aria-label="Contact Campus Ride legal support">
                Talk to support
              </Link>
            </AnimatedButton>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="md:hidden rounded-2xl border border-primary/20 bg-slate-900/70 p-4 text-sm text-slate-300 shadow-lg">
            <p className="font-semibold text-slate-100 mb-2">Quick navigation</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => {
                const domId = `${activeTab}-${section.id}`;
                return (
                  <a
                    key={domId}
                    href={`#${domId}`}
                    className="rounded-full border border-border/40 bg-slate-800/70 px-3 py-1 text-xs hover:border-primary/50 hover:text-primary transition-colors duration-200"
                  >
                    {section.title}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 md:hidden" aria-label="Accordion view of sections">
            {sections.map((section) => {
              const domId = `${activeTab}-${section.id}`;
              return (
                <details key={domId} id={domId} className="group rounded-2xl border border-border/40 bg-slate-900/70 p-4 open:border-primary/40 transition-all duration-200">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-base font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="flex items-center gap-2">
                      <span className="rounded-lg bg-primary/10 p-2 text-primary">{section.icon}</span>
                      {section.title}
                    </span>
                    <Chevron />
                  </summary>
                  <div className="mt-3 space-y-2 text-slate-300">
                    <p className="text-sm text-slate-300">{section.summary}</p>
                    <ul className="space-y-2 text-sm">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {section.footnote && (
                      <Callout tone={section.tone ?? "info"} text={section.footnote} />
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="space-y-6">
            {sections.map((section, idx) => {
              const domId = `${activeTab}-${section.id}`;
              return (
                <Reveal key={domId} delay={idx * 40} className="hidden md:block">
                  <AnimatedCard id={domId} className="glass-surface border border-primary/20 bg-gradient-to-br from-card/80 via-card/70 to-card/60 p-6 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          {section.icon}
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{activeTab === "terms" ? "Terms" : "Privacy"}</p>
                          <h2 className="text-xl font-semibold text-slate-50">{section.title}</h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyLink(domId)}
                        className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition-all duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        aria-label={`Copy link to ${section.title}`}
                      >
                        <LinkIcon className="h-4 w-4" />
                        {copiedId === domId ? "Copied" : "Copy link"}
                      </button>
                    </div>
                    <p className="mt-4 text-slate-300">{section.summary}</p>
                    <ul className="mt-4 space-y-2 text-slate-200">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {section.footnote && (
                      <div className="mt-4">
                        <Callout tone={section.tone ?? "info"} text={section.footnote} />
                      </div>
                    )}
                  </AnimatedCard>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={120} className="rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card/80 to-accent/10 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Need more detail?</p>
                <h3 className="text-2xl font-semibold text-slate-50">We are here to clarify</h3>
                <p className="text-slate-300">Ask anything about responsibilities, privacy controls, or safety defaults.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AnimatedButton asChild size="lg" className="rounded-full px-6">
                  <Link href="/contact-us" aria-label="Contact Campus Ride support">
                    Contact support
                  </Link>
                </AnimatedButton>
                <AnimatedButton asChild variant="outline" size="lg" className="rounded-full border-primary/40 text-slate-200 hover:text-primary">
                  <Link href="/how-it-works" aria-label="See how Campus Ride works">
                    How it works
                  </Link>
                </AnimatedButton>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function Callout({ tone = "info", text }: { tone?: "warning" | "info"; text: string }) {
  const toneStyles =
    tone === "warning"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
      : "border-primary/30 bg-primary/10 text-slate-100";

  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-sm ${toneStyles}`}>
      {tone === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <Info className="mt-0.5 h-4 w-4" />}
      <span>{text}</span>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="transition-transform duration-200 group-open:rotate-180">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
