"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { useUser, useFirestore } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/Reveal';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ShieldCheck, AlertOctagon, Bug, Check } from 'lucide-react';

export default function ReportPage() {
  const { user, initialized } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [role, setRole] = useState<'driver'|'passenger'>('passenger');
  const [againstUserUid, setAgainstUserUid] = useState('');
  const [rideId, setRideId] = useState('');
  const [university, setUniversity] = useState('');
  const [category, setCategory] = useState<'misbehavior'|'safety'|'fraud'|'app_issue'>('misbehavior');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  // Redirect non-authenticated users
  useEffect(() => {
    if (initialized && user === null) {
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Required', 
        description: 'Please log in to submit a report.' 
      });
      router.push('/auth/select-university');
    }
  }, [user, initialized, router, toast]);

  // Show loading state while checking authentication
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated (this prevents flash of content)
  if (!user) {
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (description.trim().length < 10) {
      toast({ variant: 'destructive', title: 'Too short', description: 'Please provide at least 10 characters.' });
      return;
    }
    setSending(true);
    setSent(false);
    try {
      const doc = {
        reportedBy: { uid: user.uid, role },
        againstUserUid: againstUserUid || null,
        rideId: rideId || null,
        category,
        description: description.trim(),
        createdAt: serverTimestamp(),
        status: 'pending' as const,
      };
      await addDoc(safeCollection(firestore!, 'reports'), doc);
      toast({ 
        title: 'Report Submitted Successfully', 
        description: 'Thank you for reporting. Our admin team will review this and respond soon.' 
      });
      setSent(true);
      // Reset form fields
      setAgainstUserUid('');
      setRideId('');
      setUniversity('');
      setDescription('');
      setCategory('misbehavior');
      // Do NOT redirect - keep user on the page
    } catch (err: any) {
      console.error('Report submit failed', err);
      toast({ variant: 'destructive', title: 'Could not submit report', description: err?.message || 'Try again later.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page relative overflow-x-hidden">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute right-0 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>
      
      {!isDashboard && <SiteHeader />}
      <main className={isDashboard ? "flex-grow relative z-10 w-full overflow-x-hidden" : "flex-grow relative z-10 w-full overflow-x-hidden"}>
        <section className={isDashboard ? "section-shell" : "section-shell max-w-2xl mx-auto"}>
          <Reveal className="space-y-8">
            {/* Header Section */}
            <div className="space-y-3 mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <AlertTriangle className="h-4 w-4" />
                Safety first
              </div>
              <h1 className="font-headline text-4xl sm:text-5xl font-bold text-slate-50">Report an issue</h1>
              <p className="text-slate-300 text-base leading-relaxed">
                Help us keep the community safe. Tell us what happened and our team will review it promptly.
              </p>
            </div>

            {/* Category Cards Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Misbehavior', icon: AlertOctagon, copy: 'Harassment, rude behavior, or disrespect.' },
                { label: 'Safety', icon: ShieldCheck, copy: 'Unsafe driving, route concerns, or discomfort.' },
                { label: 'Fraud', icon: AlertTriangle, copy: 'Payments, scams, or suspicious activity.' },
                { label: 'App issue', icon: Bug, copy: 'Bugs, crashes, or data errors.' },
              ].map((item) => (
                <div key={item.label} className="group p-4 rounded-lg bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/20 text-primary flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-50 text-sm">{item.label}</h3>
                      <p className="text-xs text-slate-400 mt-1">{item.copy}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Success Message */}
            {sent && (
              <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-green-900/40 to-green-800/30 px-4 py-4 text-sm text-slate-50 shadow-lg shadow-green-500/20 backdrop-blur-sm border border-green-500/30 animate-bounce-in">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-green-400 flex-shrink-0">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-lg mb-1">Report Submitted Successfully!</div>
                  <p className="text-slate-300">Thank you for helping keep our community safe. Our admin team will review your report and respond soon.</p>
                </div>
              </div>
            )}

            {/* Form Card */}
            <Card className="bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 shadow-lg shadow-primary/5 backdrop-blur-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-headline text-slate-50">Submit your report</CardTitle>
                <p className="text-sm text-slate-400 mt-2">Provide details to help our team understand the situation better. Minimum 10 characters required.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-5">
                  {/* Report Role */}
                  <div className="space-y-2.5">
                    <label htmlFor="role" className="text-sm font-semibold text-slate-200 block">You are reporting as</label>
                    <Select value={role} onValueChange={(v: any) => setRole(v)}>
                      <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary" id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900">
                        <SelectItem value="driver">Ride Provider</SelectItem>
                        <SelectItem value="passenger">Passenger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Optional Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2.5">
                      <label htmlFor="uid" className="text-sm font-semibold text-slate-200 block">Against user (UID)</label>
                      <Input 
                        id="uid"
                        value={againstUserUid} 
                        onChange={(e) => setAgainstUserUid(e.target.value)} 
                        placeholder="User UID (optional)" 
                        className="bg-slate-800/50 backdrop-blur-sm text-slate-200 placeholder:text-slate-500 focus:shadow-lg focus:shadow-primary/20" 
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label htmlFor="rideId" className="text-sm font-semibold text-slate-200 block">Ride ID</label>
                      <Input 
                        id="rideId"
                        value={rideId} 
                        onChange={(e) => setRideId(e.target.value)} 
                        placeholder="Ride document ID (optional)" 
                        className="bg-slate-800/50 backdrop-blur-sm text-slate-200 placeholder:text-slate-500 focus:shadow-lg focus:shadow-primary/20" 
                      />
                    </div>
                  </div>

                  {/* University & Category Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2.5">
                      <label htmlFor="university" className="text-sm font-semibold text-slate-200 block">University</label>
                      <Select value={university} onValueChange={setUniversity}>
                        <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary" id="university">
                          <SelectValue placeholder="Select university (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900">
                          <SelectItem value="fast">FAST-NUCES</SelectItem>
                          <SelectItem value="ned">NED University</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <label htmlFor="category" className="text-sm font-semibold text-slate-200 block">Category</label>
                      <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                        <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary" id="category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900">
                          <SelectItem value="misbehavior">Misbehavior</SelectItem>
                          <SelectItem value="safety">Safety</SelectItem>
                          <SelectItem value="fraud">Fraud</SelectItem>
                          <SelectItem value="app_issue">App Issue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2.5">
                    <label htmlFor="description" className="text-sm font-semibold text-slate-200 block">Description</label>
                    <Textarea
                      id="description"
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      minLength={10}
                      placeholder="What happened? Include date, time, route, and any other relevant details..."
                      className="bg-slate-800/50 backdrop-blur-sm text-slate-200 placeholder:text-slate-500 focus:shadow-lg focus:shadow-primary/20 resize-none"
                    />
                    <p className="text-xs text-slate-400">Character count: {description.length}/required: 10 minimum</p>
                  </div>

                  {/* Submit Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                    <Button 
                      type="submit" 
                      disabled={sending || description.trim().length < 10} 
                      className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30 hover:shadow-primary/50 text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                      aria-busy={sending}
                    >
                      {sending ? 'Sending...' : 'Submit report'}
                    </Button>
                    <p className="text-xs text-slate-400">Your information is secure and shared only with admins handling your case.</p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </Reveal>
        </section>
      </main>
    </div>
  );
}
