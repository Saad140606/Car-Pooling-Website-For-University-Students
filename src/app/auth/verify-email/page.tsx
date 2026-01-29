'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import Logo from '@/components/logo';
import { OtpInput } from '@/components/OtpInput';
import { Reveal } from '@/components/Reveal';

// Mark this page as dynamic so Next.js doesn't try to prerender it
export const dynamic = 'force-dynamic';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { toast } = useToast();

  const email = searchParams.get('email');
  const university = searchParams.get('university');
  const uid = searchParams.get('uid');

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email || !university || !uid) {
      router.push('/auth/select-university');
    }
  }, [email, university, uid, router]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6 || !uid) {
      setOtpError(true);
      setTimeout(() => setOtpError(false), 600);
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Enter the 6-digit code.' });
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch('/api/verify-signup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, otp }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setOtpError(true);
        setTimeout(() => setOtpError(false), 600);
        const msg = String(payload?.error || 'Verification failed');
        
        // ===== CRITICAL: Handle email conflict (409) and cleanup account =====
        if (response.status === 409) {
          console.error('Email conflict detected, cleaning up Firebase user...');
          // Delete Firebase user since email is registered with another university
          try {
            if (auth?.currentUser) {
              await auth.currentUser.delete();
              console.log('Firebase user deleted due to email conflict');
            }
          } catch (deleteErr: any) {
            console.warn('Could not delete Firebase user:', deleteErr);
            // Don't block the error flow if delete fails
          }
          
          toast({ variant: 'destructive', title: 'Email Already Registered', description: msg });
          setTimeout(() => {
            router.push('/auth/select-university');
          }, 2000);
          setVerifying(false);
          return;
        }
        // ===== END CRITICAL CLEANUP =====
        
        if (/invalid code/i.test(msg)) {
          toast({ variant: 'destructive', title: 'Invalid code', description: 'Please try again.' });
        } else {
          toast({ variant: 'destructive', title: 'Verification failed', description: msg });
        }
        setVerifying(false);
        return;
      }

      setVerified(true);
      toast({ title: 'Email verified!', description: 'You can now sign in with your account.' });
      setTimeout(() => {
        router.push(`/auth/${university}/login`);
      }, 1200);
    } catch (e: any) {
      console.error('Error verifying OTP:', e);
      setOtpError(true);
      setTimeout(() => setOtpError(false), 600);
      toast({ variant: 'destructive', title: 'Verification failed', description: e?.message || 'Please try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || !university || !uid) return;

    setResending(true);
    try {
      const response = await fetch('/api/send-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email, university }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to resend code');
      }

      setTimeLeft(600);
      setCanResend(false);
      setOtp('');
      toast({ title: 'Code resent', description: 'Check your email for the new code.' });
    } catch (e: any) {
      console.error('Error resending OTP:', e);
      toast({ variant: 'destructive', title: 'Error', description: e?.message || 'Could not resend code.' });
    } finally {
      setResending(false);
    }
  };

  if (!email || !university || !uid) {
    return null;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Animated gradient backdrop */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" />
        <div className="absolute -right-40 -bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="absolute top-8 left-8 animate-fade-slide">
        <Logo />
      </div>

      <Reveal className="w-full max-w-md" delay={80}>
        <Card className="glass-surface soft-shadow border border-primary/20">
          {verified ? (
            <CardContent className="pt-8">
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 blur-2xl rounded-full animate-pulse" />
                    <CheckCircle2 className="relative h-16 w-16 text-primary animate-bounce" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Email Verified!</h2>
                  <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
                </div>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                <CardDescription>Enter the 6-digit code sent to {email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-primary/10 border-primary/30 rounded-lg">
                  <Mail className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm text-primary/90 font-medium">
                    Check your inbox (and spam folder) for the verification code
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-foreground">Verification Code</label>
                    <div className="flex justify-center">
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={6}
                        disabled={verifying || verified}
                        error={otpError}
                        onComplete={handleVerifyOtp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      {otp.length > 0 ? `${otp.length} of 6 digits` : 'Enter the code from your email'}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={verifying || otp.length !== 6 || verified}
                  className="w-full rounded-full font-semibold h-11 transition-all"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying Code...
                    </>
                  ) : verified ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Email Verified
                    </>
                  ) : (
                    'Verify Email'
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card/80 px-3 text-muted-foreground">Didn't receive the code?</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleResendOtp}
                  disabled={!canResend || resending}
                  className="w-full rounded-full font-semibold h-11"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : canResend ? (
                    'Resend Code'
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      <span>Resend in</span>
                      <span className="font-mono text-primary font-bold">{formatTimer(timeLeft)}</span>
                    </span>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => router.push('/auth/select-university')}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign Up
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </Reveal>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-primary/15 to-accent/10 blur-3xl opacity-60" />
        </div>
        <div className="absolute top-8 left-8">
          <Logo />
        </div>
        <Card className="w-full max-w-md glass-surface soft-shadow">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
