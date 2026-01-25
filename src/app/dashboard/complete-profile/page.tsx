"use client";

import { useState, useEffect, useRef } from "react";
import { getPendingGender, clearPendingGender, getPendingUniversity, getSelectedUniversity, isValidUniversity } from '@/lib/university';
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { getUniversityShortLabel } from '@/lib/universities';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { getUniversityEmailDomain, isValidUniversityEmail, getVerificationEmailMessage } from '@/lib/university-verification';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, Mail, CheckCircle2 } from 'lucide-react';

export default function CompleteProfilePage() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("" as any);
  const [university, setUniversity] = useState<"ned" | "fast" | "">("" as any);
  const [contactNumber, setContactNumber] = useState("");
  const [universityEmail, setUniversityEmail] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [verifiedLocal, setVerifiedLocal] = useState(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  
  const [saving, setSaving] = useState(false);

  // If the sign-in email already matches the university domain, treat as auto-verified
  const derivedUniversity = userData?.university || university;
  const isAutoVerified = Boolean(
    user?.email && derivedUniversity && isValidUniversityEmail(user.email, derivedUniversity)
  );

  useEffect(() => {
    // If profile is complete, go to dashboard. Otherwise pre-fill any values we have.
    if (userData) {
      const complete = userData.fullName && userData.gender && userData.university && userData.contactNumber;
      if (complete) {
        router.replace('/dashboard/rides');
        return;
      }
      // prefill fields from existing profile (if any)
      if (userData.fullName) setFullName(userData.fullName);
      if (userData.gender) setGender((userData.gender as any) || undefined);
      if (userData.university) setUniversity((userData.university as any) || undefined);
      if (userData.contactNumber) setContactNumber(userData.contactNumber);
      if (userData.universityEmail) setUniversityEmail(userData.universityEmail);
      if (userData.universityEmailVerified) {
        setVerifiedLocal(true);
        setVerificationSent(false);
      }
      
    }

    // try to infer university from email when not set (used as authoritative if user didn't register with a university field)
    if (user && user.email && !university) {
      if (user.email.endsWith('@nu.edu.pk')) setUniversity('fast');
      if (user.email.endsWith('@neduet.edu.pk')) setUniversity('ned');
    }
    if (user && user.displayName && !fullName) {
      setFullName(user.displayName);
    }
    if (isAutoVerified && user?.email && !universityEmail) {
      setUniversityEmail(user.email.toLowerCase());
    }
  }, [user, userData, router, university, fullName]);

  // Lock the university to what the user chose at the auth selector; fall back to pending/selected portal value.
  useEffect(() => {
    if (university) return;
    try {
      const pending = getPendingUniversity();
      if (isValidUniversity(pending)) {
        setUniversity(pending as any);
        return;
      }
      const selected = getSelectedUniversity();
      if (isValidUniversity(selected)) setUniversity(selected as any);
    } catch (_) {}
  }, [university]);

  useEffect(() => {
    if (!verificationSent || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [verificationSent, timeLeft]);

  // If the user has a pending gender from signup, prefill it and keep it locked.
  useEffect(() => {
    try {
      const pending = getPendingGender();
      if (!userData?.gender && pending) {
        setGender(pending as any);
      }
    } catch (e) {}
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!fullName || !gender || !contactNumber) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill all required fields.' });
      return;
    }

    // Ensure we have a university value (either existing or inferred / selected)
    const finalUniversity = derivedUniversity || university;
    if (!finalUniversity) {
      toast({ variant: 'destructive', title: 'Missing university', description: 'We could not determine your university from sign-up. Please return to the university selector and sign in again, or contact support.' });
      return;
    }

    // Validate university email if provided
    if (universityEmail && !isValidUniversityEmail(universityEmail, finalUniversity)) {
      const domain = getUniversityEmailDomain(finalUniversity);
      toast({ 
        variant: 'destructive', 
        title: 'Invalid university email', 
        description: `Please enter a valid ${finalUniversity.toUpperCase()} email ending with ${domain}` 
      });
      return;
    }

    // Normalize and validate Pakistan mobile number; store in 11-digit format starting with 03
    let normalized = contactNumber.replace(/\D/g, ''); // strip non-digits
    // Convert common international prefixes to local 0-prefixed form
    if (normalized.startsWith('0092') && normalized.length >= 12) {
      // 0092XXXXXXXXX -> 0XXXXXXXXXX
      normalized = '0' + normalized.slice(4);
    } else if (normalized.startsWith('92') && normalized.length >= 11) {
      // 92XXXXXXXXX -> 0XXXXXXXXXX
      normalized = '0' + normalized.slice(2);
    } else if (normalized.length === 10 && normalized.startsWith('3')) {
      // 3XXXXXXXXX -> 03XXXXXXXXX
      normalized = '0' + normalized;
    }
    const pakPhoneRegex = /^03\d{9}$/; // enforce 11 digits starting with 03
    if (!pakPhoneRegex.test(normalized)) {
      toast({ variant: 'destructive', title: 'Invalid contact', description: 'Please enter an 11-digit Pakistani mobile number starting with 03 (e.g. 03XXXXXXXXX).' });
      return;
    }

    setSaving(true);
    try {
      // Validate that we have a valid email before proceeding
      if (!user.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'No email associated with your account. Please sign out and sign in again.' });
        setSaving(false);
        return;
      }

      const userDocRef = doc(firestore, 'universities', finalUniversity, 'users', user.uid);
      const existingSnap = await getDoc(userDocRef);

      // Check if document is corrupted (missing email or university)
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as any;
        console.log('Existing document data:', existing);
        
        if (!existing.email || !existing.university) {
          console.warn('Document is corrupted. Using server-side fix...');
          // Use server-side endpoint to fix corrupted document
          const idToken = await user.getIdToken();
          const fixResponse = await fetch('/api/fix-profile', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              university: finalUniversity,
              fullName,
              gender,
              contactNumber: normalized,
            }),
          });

          if (!fixResponse.ok) {
            const error = await fixResponse.json();
            throw new Error(error?.error || 'Failed to fix profile');
          }

          toast({ title: 'Profile updated', description: 'Your profile is now complete.' });
          router.push('/dashboard/rides');
          return;
        }
      }

      // Normal flow for non-corrupted documents
      const profileData: any = {
        uid: user.uid,
        name: fullName, // For CanonicalUserProfile compatibility
        fullName,
        gender,
        contactNumber: normalized,
      };

      // University email handling
      if (isAutoVerified && user?.email) {
        profileData.universityEmail = user.email.toLowerCase();
        profileData.universityEmailVerified = true;
        profileData.universityEmailVerifiedAt = serverTimestamp();
      } else if (universityEmail) {
        profileData.universityEmail = universityEmail.toLowerCase();
        profileData.universityEmailVerified = false;
      }

      if (existingSnap.exists()) {
        const existing = existingSnap.data() as any;
        await setDoc(userDocRef, {
          ...profileData,
          email: existing.email,
          university: existing.university,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await setDoc(userDocRef, { 
          ...profileData, 
          email: user.email, 
          university: finalUniversity, 
          createdAt: serverTimestamp() 
        });
      }

      toast({ title: 'Profile updated', description: 'Your profile is now complete.' });
      router.push('/dashboard/rides');
    } catch (e: any) {
      console.error('Error saving profile:', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!user || !firestore) return;
    
    const finalUniversity = derivedUniversity || university;
    if (!finalUniversity) {
      toast({ variant: 'destructive', title: 'Missing university', description: 'We could not determine your university from sign-up. Please return to the university selector and sign in again, or contact support.' });
      return;
    }

    if (!universityEmail) {
      toast({ variant: 'destructive', title: 'Missing email', description: 'Please enter your university email.' });
      return;
    }

    if (!isValidUniversityEmail(universityEmail, finalUniversity)) {
      const domain = getUniversityEmailDomain(finalUniversity);
      toast({ 
        variant: 'destructive', 
        title: 'Invalid university email', 
        description: `Please enter a valid ${finalUniversity.toUpperCase()} email ending with ${domain}` 
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
          university: finalUniversity,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to send verification code');
      }

      const data = await response.json();
      // Do not write universityEmail client-side for unverified users due to Firestore rules.
      // Server will persist universityEmail upon successful verification.

      setVerificationSent(true);
      setTimeLeft(600);
      setOtp('');
      toast({ 
        title: 'Code sent', 
        description: data.otp 
          ? `Dev only: OTP ${data.otp}. Check your inbox and spam/junk folder.` 
          : `Verification code sent to ${universityEmail}. Check your inbox and spam/junk folder.` 
      });
      // Focus OTP input for quicker entry
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
      toast({ title: 'Email verified', description: 'Trusted badge unlocked.' });
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
  // Clear any pending gender saved at signup once this page mounts
  useEffect(() => {
    try { clearPendingGender(); } catch (_) {}
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-headline mb-4">Complete Your Profile</h1>
      <p className="mb-4 text-sm text-muted-foreground">We need a few details to finish setting up your account so you can create rides.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <Select value={gender || ""} onValueChange={(v: any) => setGender(v as any)} disabled={Boolean(userData?.gender)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            {userData?.gender ? (
              <p className="text-xs text-muted-foreground mt-1">Your gender is locked. Choose correctly — it cannot be changed later.</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Please choose your gender carefully; it will be used to enforce gender-specific rides and cannot be changed later.</p>
            )}
          </div>

          
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contact Number (preferred WhatsApp)</label>
          <Input
            placeholder="03XXXXXXXXX"
            value={contactNumber}
            maxLength={11}
            onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
          />
          <p className="text-xs text-muted-foreground mt-1">Enter an 11-digit Pakistani mobile number starting with 03 (e.g. 03XXXXXXXXX)</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">University</label>
          <Input value={derivedUniversity ? getUniversityShortLabel(derivedUniversity) : 'University not set'} disabled />
          <p className="text-xs text-muted-foreground mt-1">Your university is locked to the portal you chose during sign-up. If this is incorrect, please contact support.</p>
          {!derivedUniversity && (
            <p className="text-xs text-destructive mt-1">We could not determine your university from sign-up. Go back to the university selector and sign in again, or contact support to fix it.</p>
          )}
        </div>

        {/* University Email Verification Section */}
        {!isAutoVerified && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-start gap-2 mb-3">
            <InfoIcon className="h-4 w-4 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold">Verify Your University Email (Optional)</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Verify your university email to gain a trusted badge and increase your acceptance rate. You can still use the app without verification.
              </p>
            </div>
          </div>

          {verifiedLocal ? (
            <Alert className="bg-green-500/10 border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-700">
                Your university email is verified! You have a trusted badge.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  University Email {derivedUniversity && `(${getUniversityEmailDomain(derivedUniversity)})`}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={derivedUniversity ? `yourname${getUniversityEmailDomain(derivedUniversity)}` : 'Enter university email'}
                    value={universityEmail}
                    onChange={(e) => setUniversityEmail(e.target.value)}
                    disabled={!derivedUniversity || sendingVerification}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleSendVerification}
                    disabled={!universityEmail || !derivedUniversity || sendingVerification || (verificationSent && timeLeft > 0)}
                    variant="outline"
                    size="sm"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingVerification
                      ? 'Sending...'
                      : verificationSent && timeLeft > 0
                        ? `Resend in ${formatTimer(timeLeft)}`
                        : 'Send Code'}
                  </Button>
                </div>
                {derivedUniversity && (
                  <p className="text-xs text-muted-foreground">
                    {getVerificationEmailMessage(derivedUniversity)}
                  </p>
                )}
                {verificationSent && (
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-700">
                      <div className="space-y-2">
                        <p>Enter the 6-digit code sent to your university email.</p>
                        <div className="flex gap-2 items-center">
                            <Input
                            ref={otpInputRef as any}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            placeholder="123456"
                            inputMode="numeric"
                            className="w-32"
                          />
                          <Button type="button" size="sm" onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6}>
                            {verifying ? 'Verifying...' : 'Verify'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">You can complete your profile now and verify later; resend available after the timer.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard/rides')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}