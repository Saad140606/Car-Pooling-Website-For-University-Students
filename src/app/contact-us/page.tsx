"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Mail, MessageCircle, CheckCircle2, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/Reveal';

export default function ContactUsPage() {
  const { user, data: userData } = useUser();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  useEffect(() => {
    if (user) {
      setName(user.displayName || userData?.fullName || '');
      setEmail(user.email || '');
    }
  }, [user, userData]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSent(false);
    try {
      const payload: any = { name, email, message };
      if (user) payload.uid = user.uid;

      const res = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast({ title: 'Message sent', description: 'Thanks, we will get back to you shortly.' });
      setMessage('');
      setSent(true);
    } catch (err: any) {
      console.error('Contact submit failed', err);
      toast({ variant: 'destructive', title: 'Could not send message', description: err?.message || 'Try again later.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      {!isDashboard && <SiteHeader />}
      <main className="flex-grow">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
          <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
          <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />
          <div className="page-shell py-8 sm:py-12 md:py-16 lg:py-20">
            <div className="grid gap-6 md:gap-10 lg:grid-cols-[1.1fr,0.9fr]">
              <Reveal className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary animate-bounce-in backdrop-blur-sm shadow-lg shadow-primary/20">
                  <MessageCircle className="h-4 w-4 animate-subtle-bounce" />
                  Contact team
                </div>
                <h1 className="font-headline text-4xl leading-tight tracking-tight sm:text-5xl text-slate-50 animate-slide-in-down">Contact Campus Ride</h1>
                <p className="text-slate-300 max-w-2xl text-lg animate-slide-in-down leading-relaxed" style={{ animationDelay: '100ms' }}>
                  Send us a message and we'll get back to you as soon as possible.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 animate-slide-in-down" style={{ animationDelay: '150ms' }}>
                  <Card className="bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex-row items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 text-primary">
                        <Mail className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg text-slate-50">Email support</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-slate-300">
                      We reply within a school day. Include ride details if available.
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className="flex-row items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 text-primary">
                        <Phone className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg text-slate-50">In-app calls</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-slate-300">
                      Call safely inside the app after a driver accepts your request.
                    </CardContent>
                  </Card>
                </div>
                {sent && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-slate-50 shadow-lg shadow-primary/20 animate-bounce-in backdrop-blur-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Message sent. We will reach out soon.
                  </div>
                )}
              </Reveal>

              <Reveal delay={120} className="relative">
                <div className="absolute left-0 top-0 h-28 w-28 rounded-full bg-primary/25 blur-3xl animate-float" aria-hidden />
                <div className="absolute right-0 bottom-0 h-32 w-32 rounded-full bg-accent/25 blur-3xl animate-float" style={{ animationDelay: '0.5s' }} aria-hidden />
                <Card className="relative bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 shadow-lg shadow-primary/5 backdrop-blur-md hover-card-lift soft-shadow">
                  <CardHeader>
                    <CardTitle className="text-2xl font-headline text-slate-50">Send us a note</CardTitle>
                    <p className="text-sm text-slate-300">Share as many details as you can. Minimum 10 characters.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={submit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200">Name</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200">Email</label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@university.edu" className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200">University (Optional)</label>
                        <Select value={university} onValueChange={setUniversity}>
                          <SelectTrigger className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50">
                            <SelectValue placeholder="Select your university" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">FAST-NUCES</SelectItem>
                            <SelectItem value="ned">NED University</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200">Message</label>
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={6}
                          required
                          minLength={10}
                          placeholder="How can we help?"
                          className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={sending} className="rounded-full px-6 shadow-lg shadow-primary/30 hover:shadow-primary/50 btn-press" aria-busy={sending}>
                          {sending ? 'Sending...' : 'Send message'}
                        </Button>
                        <p className="text-xs text-slate-400">We respond faster to logged-in students.</p>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
