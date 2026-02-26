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
import { ShieldCheck, ArrowLeft, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSelectedUniversity, isValidUniversity, University } from '@/lib/university';

function SetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const emailFromUrl = searchParams.get('email');
  const universityFromUrl = searchParams.get('university');
  const [email, setEmail] = useState<string>('');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number;
  } | null>(null);

  // Parse email from URL or redirect
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    } else {
      router.push('/auth/forgot-password');
    }

    const decodedUniversity = universityFromUrl ? decodeURIComponent(universityFromUrl) : getSelectedUniversity();
    if (decodedUniversity && isValidUniversity(decodedUniversity)) {
      setSelectedUniversity(decodedUniversity);
      return;
    }

    setError('University session missing. Please restart password reset from your portal.');
  }, [emailFromUrl, universityFromUrl, router]);

  // Password validation checks
  const passwordLength = password.length;
  const isPasswordValid = passwordLength >= 8;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit = isPasswordValid && passwordsMatch && !isResetting && !!selectedUniversity;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (passwordLength < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your password');
      return;
    }

    if (!selectedUniversity) {
      setError('University session missing. Please restart password reset from your portal.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/confirm-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          newPassword: password,
          university: selectedUniversity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      // Store rate limit info if available
      if (data.rateLimitInfo) {
        setRateLimitInfo(data.rateLimitInfo);
      }

      toast({
        title: 'Success!',
        description: data.rateLimitInfo?.remaining !== undefined
          ? `Your password has been reset. You have ${data.rateLimitInfo.remaining} password change${data.rateLimitInfo.remaining !== 1 ? 's' : ''} remaining in this period.`
          : 'Your password has been reset. You can now sign in with your new password.',
      });

      // Redirect to sign-in after a brief delay
      setTimeout(() => {
        router.push('/auth/select-university');
      }, 1500);
    } catch (err: any) {
      console.error('Error resetting password:', err);
      const errorMsg = err.message || 'Failed to reset password. Please try again.';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: errorMsg,
      });
    } finally {
      setIsResetting(false);
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
              Step 3 of 3
            </div>
            <CardTitle className="text-2xl text-slate-50">Set New Password</CardTitle>
            <p className="text-sm text-slate-300">Create a strong password for your account</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
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

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-200">New Password</label>
                    <span className="text-xs text-slate-400">
                      {passwordLength} / 8+ characters
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your new password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      disabled={isResetting}
                      className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50 text-slate-50 placeholder:text-slate-500 disabled:opacity-50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  <div className="mt-2 p-3 rounded-lg border border-border/40 bg-slate-900/30">
                    <div className="flex items-center gap-2">
                      {isPasswordValid ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-slate-400" />
                      )}
                      <span className={`text-xs ${isPasswordValid ? 'text-green-400' : 'text-slate-400'}`}>
                        At least 8 characters
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      disabled={isResetting}
                      className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50 text-slate-50 placeholder:text-slate-500 disabled:opacity-50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Password match indicator */}
                  {confirmPassword && (
                    <div className="mt-2 p-3 rounded-lg border border-border/40 bg-slate-900/30">
                      <div className="flex items-center gap-2">
                        {passwordsMatch ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-xs ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 shadow-lg shadow-primary/30 hover:shadow-primary/50 rounded-lg font-semibold"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
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
                <strong>💡 Security Tips:</strong>
              </p>
              <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                <li>Use at least 8 characters</li>
                <li>Mix uppercase, lowercase, numbers, and symbols</li>
                <li>Avoid using personal information</li>
                <li>Don't reuse passwords from other accounts</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="text-slate-300">Loading...</div>
      </main>
    }>
      <SetPasswordPageContent />
    </Suspense>
  );
}
