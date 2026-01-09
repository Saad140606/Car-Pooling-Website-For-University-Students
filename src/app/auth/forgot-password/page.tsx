"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  // manual code flow
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
      return;
    }
    setIsSending(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast({ title: 'Reset Email Sent', description: 'Check your email for a password reset link.' });
    } catch (e: any) {
      console.error('sendPasswordResetEmail failed', e);
      toast({ variant: 'destructive', title: 'Error Sending Email', description: e?.message || 'Could not send password reset email.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleManualReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setVerifying(true);
    try {
      // verify code first (this returns the email if valid)
      await verifyPasswordResetCode(auth, code);
      // apply new password
      await confirmPasswordReset(auth, code, newPassword);
      toast({ title: 'Password Reset', description: 'Your password has been updated. You can now sign in.' });
      router.push('/auth/select-university');
    } catch (e: any) {
      console.error('Password reset with code failed', e);
      toast({ variant: 'destructive', title: 'Reset Failed', description: e?.message || 'Invalid or expired code.' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Link href="/">Back</Link>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">University Email</label>
                <Input placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSending}>{isSending ? 'Sending...' : 'Send Reset Email'}</Button>
                <Button variant="ghost" onClick={() => router.push('/')}>Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">If you received a reset email but prefer to enter the code/link manually, use the form below.</p>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">A password reset email has been sent to <strong>{email}</strong>. Click the link in that email to reset your password. If you prefer, you can paste the code (oobCode) below and set a new password manually.</p>
              <div className="flex gap-2">
                <Button onClick={() => { setSent(false); setEmail(''); }}>Send to another email</Button>
                <Button variant="ghost" onClick={() => router.push('/auth/select-university')}>Back to Sign In</Button>
              </div>
            </div>
          )}

          <hr className="my-4" />

          <div>
            <h3 className="font-medium">Have a code (oobCode)? Reset here</h3>
            <form onSubmit={handleManualReset} className="space-y-3 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1">Reset Code (oobCode)</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code from the email (oobCode)" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={verifying}>{verifying ? 'Applying...' : 'Apply New Password'}</Button>
                <Button variant="ghost" onClick={() => { setCode(''); setNewPassword(''); }}>Reset</Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
