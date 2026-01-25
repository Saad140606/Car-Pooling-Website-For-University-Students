'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2 } from 'lucide-react';
import Logo from '@/components/logo';

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
        const msg = String(payload?.error || 'Verification failed');
        if (/invalid code/i.test(msg)) {
          toast({ variant: 'destructive', title: 'Invalid code', description: 'Please try again.' });
        } else {
          toast({ variant: 'destructive', title: 'Verification failed', description: msg });
        }
        setVerifying(false);
        return;
      }

      toast({ title: 'Email verified!', description: 'You can now sign in with your account.' });
      router.push(`/auth/${university}/login`);
    } catch (e: any) {
      console.error('Error verifying OTP:', e);
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
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Logo />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>We sent a 6-digit code to {email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Mail className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-700">
              Check your inbox (and spam folder) for the verification code
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Verification Code</label>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="123456"
              inputMode="numeric"
              className="text-center text-2xl tracking-widest"
            />
            <p className="text-xs text-muted-foreground">Enter the 6-digit code from your email</p>
          </div>

          <Button
            onClick={handleVerifyOtp}
            disabled={verifying || otp.length !== 6}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Didn't receive the code?
            </p>
            <Button
              variant="outline"
              onClick={handleResendOtp}
              disabled={!canResend || resending}
              className="w-full"
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : canResend ? (
                'Resend Code'
              ) : (
                `Resend in ${formatTimer(timeLeft)}`
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => router.push('/auth/select-university')}
            className="w-full"
          >
            Back to Sign Up
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="absolute top-8 left-8">
          <Logo />
        </div>
        <Card className="w-full max-w-md">
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
