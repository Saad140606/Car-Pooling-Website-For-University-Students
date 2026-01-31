"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { getUniversityShortLabel } from '@/lib/universities';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { Mail, CheckCircle2, InfoIcon } from 'lucide-react';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getUniversityEmailDomain, isValidUniversityEmail, getVerificationEmailMessage } from '@/lib/university-verification';
import { checkPasswordChangeRateLimit, updatePasswordChangeTracking, formatResetDate } from '@/lib/passwordRateLimit';

export default function AccountPage() {
  const router = useRouter();
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | undefined>(undefined);
  const [contactNumber, setContactNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // University email verification
  const [universityEmail, setUniversityEmail] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [verifiedLocal, setVerifiedLocal] = useState(false);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [passwordRateLimit, setPasswordRateLimit] = useState<{
    allowed: boolean;
    count: number;
    remaining: number;
    resetDate: Date | null;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (userData) {
      setFullName(userData.fullName || '');
      setGender((userData.gender as any) || undefined);
      setContactNumber((userData.contactNumber || '').toString().replace(/\D/g, '').slice(0, 11));
      if (userData.universityEmail) setUniversityEmail(userData.universityEmail);
      setVerifiedLocal(Boolean(userData.universityEmailVerified));
      if (userData.universityEmailVerified) {
        setVerificationSent(false);
      }
    }
    if (user && user.displayName && !userData?.fullName) {
      setFullName(user.displayName);
    }
  }, [userData, user]);

  // Check password change rate limit on mount and userData change
  useEffect(() => {
    if (user && firestore && userData) {
      const rateLimitCheck = checkPasswordChangeRateLimit({
        passwordChangeCount: userData.passwordChangeCount,
        passwordChangeWindowStart: userData.passwordChangeWindowStart,
      });
      setPasswordRateLimit(rateLimitCheck);
    }
  }, [user, firestore, userData]);

  useEffect(() => {
    if (!verificationSent || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [verificationSent, timeLeft]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!fullName || !gender || !contactNumber) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill all required fields.' });
      return;
    }
    setSaving(true);
    try {
      const university = userData?.university || 'fast';
      const userDocRef = doc(firestore, 'universities', university, 'users', user.uid);
      const existingSnap = await getDoc(userDocRef);
      const baseUpdate = {
        uid: user.uid,
        fullName,
        gender,
        contactNumber: contactNumber.replace(/\s|-/g, ''),
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as any;
        
        // Check if document is corrupted (missing email or university)
        if (!existing.email || !existing.university) {
          console.warn('Document is corrupted (missing email/university). Overwriting with complete data...');
          // Overwrite the corrupted document completely (merge: false acts like create)
          await setDoc(userDocRef, { 
            ...baseUpdate, 
            email: user.email, 
            university, 
            createdAt: serverTimestamp() 
          }, { merge: false });
        } else {
          // Document has valid email/university, proceed with update
          await setDoc(userDocRef, {
            ...baseUpdate,
            email: existing.email,
            university: existing.university
          }, { merge: true });
        }
      } else {
        // For create: use auth email (required by Firestore rules)
        await setDoc(userDocRef, { 
          ...baseUpdate, 
          email: user.email, 
          university, 
          createdAt: serverTimestamp() 
        });
      }

      // Also update auth profile displayName for convenience
      if (auth && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: fullName });
      }

      toast({ title: 'Profile updated', description: 'Your account information was updated.' });
    } catch (e: any) {
      console.error('Failed to update profile:', e);
      toast({ variant: 'destructive', title: 'Error', description: e?.message || 'Could not update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !auth.currentUser || !auth.currentUser.email) return;
    if (!currentPassword || !newPassword) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter current and new password.' });
      return;
    }

    // Prevent using the same password again
    if (currentPassword.trim() === newPassword.trim()) {
      toast({ variant: 'destructive', title: 'New password matches current', description: 'Your new password must be different from the current password.' });
      return;
    }

    // Ensure the account supports email/password authentication
    const providers = auth.currentUser.providerData || [];
    const hasPasswordProvider = providers.some((p) => p.providerId === 'password');
    if (!hasPasswordProvider) {
      toast({ variant: 'destructive', title: 'Password not set', description: 'Your account was created using a social login and does not have a password. Use "Forgot Password" to create one for your email.' });
      return;
    }

    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);

      // Reauthenticate first and give a clear message if the current password is incorrect
      try {
        await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (reauthErr: any) {
        // Avoid noisy console error output for expected user errors (wrong password/invalid credential).
        if (reauthErr?.code === 'auth/wrong-password' || reauthErr?.code === 'auth/invalid-credential') {
          console.debug('Reauthentication failed: invalid credentials');
          toast({ variant: 'destructive', title: 'Incorrect current password', description: 'The current password you entered is incorrect. Use "Forgot Password" to reset it.' });
        } else if (reauthErr?.code === 'auth/too-many-requests') {
          console.debug('Reauthentication failed: too many attempts', reauthErr);
          toast({ variant: 'destructive', title: 'Too many attempts', description: 'Too many failed attempts. Try again later or use "Forgot Password".' });
        } else {
          console.error('Reauthentication failed:', reauthErr);
          toast({ variant: 'destructive', title: 'Re-authentication failed', description: reauthErr?.message || 'Please try again.' });
        }
        return;
      }

      // If reauthentication succeeded, proceed to update the password and handle errors separately
      try {
        // Check password change rate limit (3 changes per 14 days)
        if (!firestore || !user) {
          throw new Error('Firestore or user not available');
        }

        const userRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const currentUserData = userDoc.data();
        
        const rateLimitCheck = checkPasswordChangeRateLimit({
          passwordChangeCount: currentUserData?.passwordChangeCount,
          passwordChangeWindowStart: currentUserData?.passwordChangeWindowStart,
        });

        if (!rateLimitCheck.allowed) {
          toast({ 
            variant: 'destructive', 
            title: 'Password change limit reached', 
            description: rateLimitCheck.message,
          });
          setPasswordRateLimit(rateLimitCheck);
          return;
        }
        
        // Update password in Firebase Auth
        await updatePassword(auth.currentUser, newPassword);
        
        // Update rate limit tracking (atomic operation)
        const updatedTracking = updatePasswordChangeTracking({
          passwordChangeCount: currentUserData?.passwordChangeCount,
          passwordChangeWindowStart: currentUserData?.passwordChangeWindowStart,
        });

        await updateDoc(userRef, {
          passwordChangeCount: updatedTracking.passwordChangeCount,
          passwordChangeWindowStart: updatedTracking.passwordChangeWindowStart,
        });

        // Update local rate limit state
        const newRateLimitCheck = checkPasswordChangeRateLimit(updatedTracking);
        setPasswordRateLimit(newRateLimitCheck);
        
        toast({ 
          title: 'Password changed', 
          description: `Your password was updated successfully. ${newRateLimitCheck.message}`,
        });
        setShowPwForm(false);
        setCurrentPassword('');
        setNewPassword('');
      } catch (updateErr: any) {
        if (updateErr?.code === 'auth/requires-recent-login') {
          console.debug('Update password failed: requires recent login', updateErr);
          toast({ variant: 'destructive', title: 'Re-authentication required', description: 'Please sign out and sign in again, then retry changing your password.' });
        } else {
          console.error('Update password failed:', updateErr);
          toast({ variant: 'destructive', title: 'Could not change password', description: updateErr?.message || 'Please try again.' });
        }
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No email available for your account.' });
      return;
    }

    // Check rate limit before sending
    if (passwordRateLimit && !passwordRateLimit.allowed) {
      toast({ 
        variant: 'destructive', 
        title: 'Password change limit reached', 
        description: passwordRateLimit.message 
      });
      return;
    }

    setResetLoading(true);
    try {
      // Send OTP to the user's email
      const response = await fetch('/api/send-password-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auth.currentUser.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429 && data.rateLimitInfo) {
          const rateLimitCheck = checkPasswordChangeRateLimit({
            passwordChangeCount: data.rateLimitInfo.count,
            passwordChangeWindowStart: data.rateLimitInfo.resetDate,
          });
          setPasswordRateLimit(rateLimitCheck);
        }
        throw new Error(data.error || 'Failed to send reset code');
      }

      toast({ title: 'Verification code sent', description: 'Check your email for the verification code.' });
      setShowPwForm(false);
      
      // Navigate to the OTP verification page
      router.push(`/auth/reset-password/verify-code?email=${encodeURIComponent(auth.currentUser.email)}`);
    } catch (e: any) {
      console.error('Send reset code failed:', e);
      toast({ 
        variant: 'destructive', 
        title: 'Could not send verification code', 
        description: e?.message || 'Please try again.' 
      });
    } finally {
      setResetLoading(false);
    }
  }; 

  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const handleSendVerification = async () => {
    if (!user || !firestore || !userData?.university) return;
    
    if (!universityEmail) {
      toast({ variant: 'destructive', title: 'Missing email', description: 'Please enter your university email.' });
      return;
    }

    if (!isValidUniversityEmail(universityEmail, userData.university)) {
      const domain = getUniversityEmailDomain(userData.university);
      toast({ 
        variant: 'destructive', 
        title: 'Invalid university email', 
        description: `Please enter a valid ${userData.university.toUpperCase()} email ending with ${domain}` 
      });
      return;
    }

    setSendingVerification(true);
    try {
      const response = await fetch('/api/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          universityEmail: universityEmail.toLowerCase(),
          university: userData.university,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to send verification code');
      }

      const data = await response.json();
      // Avoid client-side write for unverified users; server persists on verification.

      setVerificationSent(true);
      setTimeLeft(600);
      setOtp('');
      toast({ 
        title: 'Code sent', 
        description: data.otp 
          ? `Dev only: OTP ${data.otp}. Check your inbox and spam/junk folder.` 
          : `Verification code sent to ${universityEmail}. Check your inbox and spam/junk folder.` 
      });
      // Focus OTP input to help the user enter the code
      setTimeout(() => otpInputRef.current?.focus(), 0);
    } catch (e: any) {
      console.error('Error sending verification:', e);
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: e.message || 'Could not send verification code.' 
      });
    } finally {
      setSendingVerification(false);
    }
  }; 

  const handleVerifyOtp = async () => {
    if (!user) return;
    if (!otp || otp.length !== 6) {
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Enter the 6-digit code sent to your email.' });
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch('/api/verify-university-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, otp, universityEmail: universityEmail.toLowerCase() }),
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

      setVerifiedLocal(true);
      setVerificationSent(false);
      setOtp('');
      toast({ title: 'Email verified', description: 'You earned the trusted badge.' });
      router.refresh();
    } catch (e: any) {
      console.error('Error verifying OTP:', e);
      toast({ variant: 'destructive', title: 'Verification failed', description: e?.message || 'Please try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-slate-50">Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
              <Input value={user?.email ?? ''} disabled className="border-border/40 bg-background/60" />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">University</label>
              <Input value={userData?.university ? getUniversityShortLabel(userData?.university) : (userData?.university || 'Unknown')} disabled className="border-border/40 bg-background/60" />
              <p className="text-xs text-slate-400 mt-1">Your university is set when you registered via the Select University page and cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Gender</label>
                <Select value={gender} onValueChange={(v) => setGender(v as any)} disabled={Boolean(userData?.gender)}>
                  <SelectTrigger className="w-full border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                {userData?.gender && <p className="text-xs text-slate-400 mt-1">Your gender is locked and cannot be changed.</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Contact Number</label>
              <Input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                maxLength={11}
                inputMode="numeric"
                pattern="\d*"
                className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"
              />
            </div>

            {/* University Email Verification Section */}
            <div className="border-t border-slate-800/50 pt-4 mt-4">
              <div className="flex items-start gap-2 mb-3">
                <InfoIcon className="h-4 w-4 text-blue-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-50">Verify Your University Email (Optional)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Verify your university email to gain a trusted badge and increase your acceptance rate.
                  </p>
                </div>
              </div>

              {verifiedLocal ? (
                <Alert className="bg-green-500/10 border-green-500/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-green-700">{userData?.universityEmail || 'Verified'}</div>
                      <div className="text-xs text-green-600">Your university email is verified</div>
                    </div>
                    <VerificationBadge verified={true} />
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
                      University Email {userData?.university && `(${getUniversityEmailDomain(userData.university)})`}
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type="email"
                        placeholder={userData?.university ? `yourname${getUniversityEmailDomain(userData.university)}` : 'Enter university email'}
                        value={universityEmail}
                        onChange={(e) => setUniversityEmail(e.target.value)}
                        disabled={!userData?.university || sendingVerification}
                        className="flex-1 border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"
                      />
                      <Button
                        type="button"
                        onClick={handleSendVerification}
                        disabled={!universityEmail || !userData?.university || sendingVerification || (verificationSent && timeLeft > 0)}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {sendingVerification
                          ? 'Sending...'
                          : verificationSent && timeLeft > 0
                            ? `Resend in ${formatTimer(timeLeft)}`
                            : 'Send Code'}
                      </Button>
                    </div>
                    {userData?.university && (
                      <p className="text-xs text-muted-foreground">
                        {getVerificationEmailMessage(userData.university)}
                      </p>
                    )}
                    {verificationSent && (
                      <Alert className="bg-blue-500/10 border-blue-500/30">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="space-y-2 text-sm text-blue-700">
                          <p>Enter the 6-digit code we sent to your university email.</p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Input
                              ref={otpInputRef as any}
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              maxLength={6}
                              placeholder="123456"
                              inputMode="numeric"
                              className="w-full sm:w-32 border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"
                            />
                            <Button type="button" size="sm" onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6} className="w-full sm:w-auto">
                              {verifying ? 'Verifying...' : 'Verify'}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Resend available after the timer ends.</p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <Button type="submit" disabled={saving} className="shadow-lg shadow-primary/30 hover:shadow-primary/50 btn-press w-full sm:w-auto">{saving ? 'Saving...' : 'Save Changes'}</Button>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => {
                setFullName(userData?.fullName || '');
                setGender(userData?.gender || undefined);
                setContactNumber((userData?.contactNumber || '').toString().replace(/\D/g, '').slice(0, 11));
              }}>Reset</Button>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowPwForm(s => !s)}>Change Password</Button>
            </div>
          </form>

          {showPwForm && (
            <div className="mt-6 border-t border-slate-800/50 pt-6">
              <h3 className="font-medium text-slate-50 mb-3">Change Password</h3>

              {/* Rate Limit Information */}
              {passwordRateLimit && !passwordRateLimit.allowed && (
                <Alert variant="destructive" className="mb-4 border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive text-sm">
                    <strong>⏰ Password Change Limit Reached</strong>
                    <br />
                    {passwordRateLimit.message}
                    {passwordRateLimit.resetDate && (
                      <>
                        <br />
                        Next available: <strong>{formatResetDate(passwordRateLimit.resetDate)}</strong>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {passwordRateLimit && passwordRateLimit.allowed && passwordRateLimit.count > 0 && (
                <Alert className="mb-4 border-blue-500/50 bg-blue-500/10">
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                    <InfoIcon className="h-4 w-4 inline mr-1" />
                    <strong>Password Changes:</strong> {passwordRateLimit.remaining} of 3 remaining in this 14-day period.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Current Password</label>
                  <Input 
                    type="password" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50" 
                    disabled={!passwordRateLimit?.allowed}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">New Password</label>
                  <Input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="border-border/40 bg-background/80 backdrop-blur-sm focus:border-primary/50"
                    disabled={!passwordRateLimit?.allowed}
                  />
                  {currentPassword && newPassword && currentPassword === newPassword && (
                    <p className="text-xs text-destructive mt-1">New password must be different from your current password.</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Button 
                    type="submit" 
                    disabled={pwLoading || !passwordRateLimit?.allowed || (currentPassword.trim() !== '' && newPassword.trim() !== '' && currentPassword === newPassword)}
                    className="w-full sm:w-auto"
                  >
                    {pwLoading ? 'Updating...' : 'Update Password'}
                  </Button>
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setShowPwForm(false)}>Cancel</Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSendResetEmail} 
                    disabled={resetLoading || !auth?.currentUser?.email || !passwordRateLimit?.allowed}
                    className="w-full sm:w-auto"
                  >
                    {resetLoading ? 'Sending...' : 'Send reset email'}
                  </Button>
                </div>
              </form>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
