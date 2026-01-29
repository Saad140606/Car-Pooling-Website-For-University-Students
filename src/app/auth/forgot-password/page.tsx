"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Reveal } from '@/components/Reveal';
import Logo from '@/components/logo';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    count: number;
    remaining: number;
    resetDate: Date | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || email.trim().length === 0) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/send-password-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429 && data.rateLimitInfo) {
          setRateLimitInfo(data.rateLimitInfo);
        }
        throw new Error(data.error || 'Failed to send reset code');
      }

      toast({
        title: 'Code Sent!',
        description: 'Check your email for the verification code',
      });

      // Navigate to code verification page and pass email
      router.push(`/auth/reset-password/verify-code?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      console.error('Error sending password reset OTP:', err);
      setError(err.message || 'Failed to send verification code. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Could not send verification code',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
      <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />

      <div className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-50 transition-colors">
        <Link href="/auth/select-university" className="flex items-center gap-2 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="absolute top-6 right-6">
        <Logo />
      </div>

      <Reveal className="w-full max-w-lg px-4">
        <Card className="border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-2xl shadow-primary/20">
          <CardHeader className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-sm w-fit">
              <ShieldCheck className="h-4 w-4" />
              Step 1 of 3
            </div>
            <CardTitle className="text-2xl text-slate-50">Reset Your Password</CardTitle>
            <p className="text-sm text-slate-300">Enter your email and we'll send you a verification code</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {rateLimitInfo && rateLimitInfo.remaining === 0 && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                    <strong>⏰ Password Change Limit Reached</strong>
                    <br />
                    You have used all 3 password changes in the past 14 days.
                    {rateLimitInfo.resetDate && (
                      <>
                        {' '}You can change your password again on{' '}
                        <strong>{new Date(rateLimitInfo.resetDate).toLocaleDateString()}</strong>.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {rateLimitInfo && rateLimitInfo.remaining > 0 && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                    <strong>ℹ️ Password Changes Remaining:</strong> {rateLimitInfo.remaining} out of 3 in this 14-day period.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  disabled={isSending}
                  className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50 text-slate-50 placeholder:text-slate-500 disabled:opacity-50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSending || !email}
                  className="flex-1 shadow-lg shadow-primary/30 hover:shadow-primary/50 rounded-lg font-semibold"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/auth/select-university')}
                  className="border-border/40 text-slate-200 hover:text-slate-50 rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </form>

            <div className="space-y-3 pt-4 border-t border-border/40">
              <p className="text-xs text-slate-400">
                <strong>💡 Tip:</strong> Make sure you have access to your email to receive the verification code
              </p>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
}
