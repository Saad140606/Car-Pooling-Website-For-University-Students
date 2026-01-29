"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Reveal } from '@/components/Reveal';
import Logo from '@/components/logo';
import { ShieldCheck, ArrowLeft, Loader2, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function VerifyCodePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const emailFromUrl = searchParams.get('email');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Parse email from URL or redirect
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    } else {
      // No email provided, redirect back
      router.push('/auth/forgot-password');
    }
  }, [emailFromUrl, router]);

  // Timer for OTP expiry
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code || code.trim().length === 0) {
      setError('Please enter the verification code');
      return;
    }

    if (code.length < 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/verify-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify code');
      }

      toast({
        title: 'Code Verified!',
        description: 'You can now set your new password',
      });

      // Navigate to set password page
      router.push(`/auth/reset-password/set-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      // Don't log to console - show user-friendly message only
      const errorMsg = err.message || 'Invalid or expired verification code';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: errorMsg,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
      const response = await fetch('/api/send-password-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send code');
      }

      toast({
        title: 'Code Sent!',
        description: 'Check your email for the new verification code',
      });

      // Reset timer
      setTimeLeft(15 * 60);
      setCanResend(false);
      setCode('');
      setError('');
    } catch (err: any) {
      console.error('Error resending code:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Could not resend code',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
      <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />

      <div className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-50 transition-colors">
        <Link href="/auth/forgot-password" className="flex items-center gap-2 hover:underline">
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
              Step 2 of 3
            </div>
            <CardTitle className="text-2xl text-slate-50">Verify Code</CardTitle>
            <p className="text-sm text-slate-300">Enter the 6-digit code we sent to your email</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">Email</label>
                <div className="text-sm text-slate-300 bg-slate-900/50 border border-border/40 rounded-lg px-3 py-2">
                  {email}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-200">Verification Code</label>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {formatTimeLeft()}
                  </div>
                </div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  disabled={isVerifying}
                  maxLength={6}
                  className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50 text-slate-50 placeholder:text-slate-500 disabled:opacity-50 text-center text-lg tracking-[0.3em] font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isVerifying || code.length < 6}
                  className="flex-1 shadow-lg shadow-primary/30 hover:shadow-primary/50 rounded-lg font-semibold"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/auth/forgot-password')}
                  className="border-border/40 text-slate-200 hover:text-slate-50 rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </form>

            <div className="space-y-3 pt-4 border-t border-border/40">
              <p className="text-xs text-slate-400">
                <strong>Didn't receive the code?</strong>
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleResendCode}
                disabled={!canResend || isResending}
                className="w-full text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Resending...
                  </>
                ) : canResend ? (
                  'Resend Code'
                ) : (
                  `Resend available in ${formatTimeLeft()}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="text-slate-300">Loading...</div>
      </main>
    }>
      <VerifyCodePageContent />
    </Suspense>
  );
}
