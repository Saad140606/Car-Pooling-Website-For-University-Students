"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { setPendingUniversity, setSelectedUniversity, getPendingUniversity, getPendingGender, clearPendingUniversity, clearPendingGender, isValidUniversity } from "@/lib/university";
import { getPendingBooking, clearPendingBooking } from '@/lib/bookings';
import { getAccountLockState, toFirestoreLockTimestamp } from "@/lib/accountLock";

import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { resolveDashboardLandingRoute } from '@/lib/dashboardLanding';
import { trackEvent } from '@/lib/ga';

type AuthFormProps = {
  university: "ned" | "fast" | "karachi";
  action: "login" | "register";
};

const universityConfig = {
  ned: { name: "NED University", domain: "cloud.neduet.edu.pk" },
  fast: { name: "FAST University", domain: "nu.edu.pk" },
  karachi: { name: "Karachi University", domain: "uok.edu.pk" },
};

export function AuthForm({ university, action }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const actionFeedback = useActionFeedback();

  const config = universityConfig[university];

  const formSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    fullName: action === 'register' ? z.string().min(3, { message: "Full name is required."}) : z.optional(z.string()),
    consent: action === 'register' ? z.boolean().refine(v => v === true, { message: 'You must accept the Terms & Regulations and Privacy Policy to register.' }) : z.optional(z.boolean()),
  });

  type AuthFormValues = {
    email: string;
    password: string;
    fullName?: string;
    consent?: boolean;
  };

  const form = useForm({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      consent: false,
    },
  });

  const detectUniversityFromEmail = (email: string): "ned" | "fast" | "karachi" | null => {
    const lowerEmail = email.toLowerCase().trim();

    if (lowerEmail.endsWith(`@${universityConfig.ned.domain}`)) return "ned";
    if (lowerEmail.endsWith(`@${universityConfig.fast.domain}`)) return "fast";
    if (lowerEmail.endsWith(`@${universityConfig.karachi.domain}`)) return "karachi";

    return null;
  };

  useEffect(() => {
    if (!loading) return;
    actionFeedback.update(
      action === 'register' ? 'Signing you up, please wait…' : 'Signing you in, please wait…',
      action === 'register' ? 'Signing up...' : 'Signing in...'
    );
  }, [loading, action, actionFeedback.update]);

  const pushPreferredDashboard = async (uid: string, uni: 'ned' | 'fast' | 'karachi') => {
    const nextRoute = await resolveDashboardLandingRoute({
      firestore,
      uid,
      university: uni,
    });
    router.push(nextRoute);
  };

  async function onGoogleSignIn() {
    const submitStartMs = performance.now();
    setLoading(true);
    actionFeedback.start('Signing you in, please wait…', 'Signing in...');

    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Firebase not initialized. Please try again later.",
      });
      setLoading(false);
      return;
    }

    try {
      setSelectedUniversity(university);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;
      const selectedUni = university;
      const normalizedEmail = (u.email || "").toLowerCase().trim();

      if (!normalizedEmail) {
        try { await signOut(auth); } catch (_) {}
        toast({
          variant: "destructive",
          title: "Sign-In Failed",
          description: "Google account email is required to continue.",
        });
        return;
      }

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (adminEmails.includes(normalizedEmail)) {
        try { await signOut(auth); } catch (_) {}
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Admin accounts cannot login through university pages. Please contact support.",
        });
        return;
      }

      // Allow any Google account to sign in. Do not enforce domain-only restriction.

      let serverResult: any = null;
      try {
        const idToken = await u.getIdToken();
        const res = await fetch('/api/admin/isMember', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ selectedUni }),
        });
        if (!res.ok) {
          throw new Error('Could not verify university membership');
        }
        serverResult = await res.json();
      } catch (err) {
        console.error('Error checking membership for Google sign-in:', err);
        try { await signOut(auth); } catch (_) {}
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Unable to verify your university portal right now. Please try again.',
        });
        return;
      }

      if (!serverResult || typeof serverResult.isMember !== 'boolean') {
        try { await signOut(auth); } catch (_) {}
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Could not validate account portal mapping. Please try again.',
        });
        return;
      }

      if (serverResult?.hasMultipleMemberships && serverResult?.registeredIn && serverResult.registeredIn !== selectedUni) {
        try { await signOut(auth); } catch (_) {}
        const uniName = serverResult.registeredIn === 'fast'
          ? 'FAST University'
          : serverResult.registeredIn === 'karachi'
            ? 'Karachi University'
            : 'NED University';
        toast({
          variant: 'destructive',
          title: 'Wrong University Portal',
          description: `This account is registered with ${uniName} portal. Please sign in through that portal only.`,
        });
        return;
      }

      if (serverResult && serverResult.isMember && serverResult.university !== selectedUni) {
        try { await signOut(auth); } catch (_) {}
        const registeredUni = serverResult.registeredIn || serverResult.university;
        const uniName = registeredUni === 'fast' ? 'FAST University' : registeredUni === 'karachi' ? 'Karachi University' : 'NED University';
        toast({
          variant: 'destructive',
          title: 'Wrong University Portal',
          description: `This Google account is registered with ${uniName} portal. Please sign in through the correct university portal.`,
        });
        return;
      }

      const universityUserRef = doc(firestore, 'universities', selectedUni, 'users', u.uid);
      const universityUserSnap = await getDoc(universityUserRef);
      const existingProfile = universityUserSnap.exists() ? (universityUserSnap.data() as any) : null;

      if (existingProfile) {
        const lockState = getAccountLockState(existingProfile);
        if (lockState.locked) {
          if (lockState.shouldPersistLock && lockState.lockUntil) {
            try {
              await updateDoc(universityUserRef, {
                accountLockUntil: toFirestoreLockTimestamp(lockState.lockUntil),
                accountLockDays: 7,
                accountLockReason: 'many_cancellations',
              });
            } catch (e) {
              console.error('Failed to persist derived account lock for Google sign-in:', e);
            }
          }

          try { await signOut(auth); } catch (_) {}
          toast({
            variant: 'destructive',
            title: 'Account Locked',
            description: lockState.message || 'Your account is temporarily locked due to multiple cancellations.',
          });
          return;
        }

        // Google sign-in must NOT auto-mark university email as verified.
        // If this was incorrectly set in older versions without verification timestamp,
        // normalize it back to false and require OTP flow.
        if (
          existingProfile?.authProvider === 'google' &&
          existingProfile?.universityEmailVerified === true &&
          !existingProfile?.universityEmailVerifiedAt
        ) {
          await setDoc(
            universityUserRef,
            {
              universityEmailVerified: false,
              emailVerified: false,
            },
            { merge: true }
          );
        }
      }

      if (!universityUserSnap.exists()) {
        await setDoc(
          universityUserRef,
          {
            uid: u.uid,
            name: u.displayName || '',
            fullName: u.displayName || '',
            email: u.email || null,
            university: selectedUni,
            role: 'passenger',
            createdAt: serverTimestamp(),
            emailVerified: false,
            universityEmailVerified: false,
            authProvider: 'google',
          },
          { merge: true }
        );
      } else {
        // Keep Google-auth account marker, but do not auto-verify university email.
        await setDoc(
          universityUserRef,
          {
            authProvider: 'google',
          },
          { merge: true }
        );
      }

      toast({
        title: 'Signed In',
        description: 'Signed in with Google successfully.',
      });
      trackEvent('login', {
        method: 'google',
        university: selectedUni,
      });

      try {
        const pending = getPendingBooking();
        if (pending && pending.rideId && pending.university && pending.university === selectedUni) {
          clearPendingBooking();
          router.push(`/dashboard/rides?pendingBooking=${encodeURIComponent(pending.rideId)}`);
          return;
        }
      } catch (_) {}

      await pushPreferredDashboard(u.uid, selectedUni);
      return;
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        toast({
          title: 'Google Sign-In Cancelled',
          description: 'Please try again when you are ready.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: error?.message || 'Could not sign in with Google. Please try again.',
        });
      }
    } finally {
      console.log('[AuthForm][perf][google] university=', university, 'total_ms=', Math.round(performance.now() - submitStartMs));
      actionFeedback.clear();
      setLoading(false);
    }
  }

  async function onSubmit(values: AuthFormValues) {
    const submitStartMs = performance.now();
    setLoading(true);
    actionFeedback.start(
      action === 'register' ? 'Signing you up, please wait…' : 'Signing you in, please wait…',
      action === 'register' ? 'Signing up...' : 'Signing in...'
    );
    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Firebase not initialized. Please try again later.",
      });
      setLoading(false);
      return;
    }

    try {
      setSelectedUniversity(university);
      // ===== BLOCK ADMIN EMAILS from university login pages =====
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
      
      if (adminEmails.includes(values.email.toLowerCase())) {
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: 'Admin accounts cannot login through university pages. Please contact support.',
        });
        setLoading(false);
        return;
      }
      // ===== END ADMIN EMAIL BLOCK =====

      if (action === "register") {
        // ===== CRITICAL: Check email availability across all universities BEFORE creating user =====
        try {
          const emailCheckResponse = await fetch('/api/check-email-available', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: values.email,
              university,
            }),
          });

          const emailCheckData = await emailCheckResponse.json();

          if (!emailCheckData.available) {
            toast({
              variant: 'destructive',
              title: 'Email Already Registered',
              description: emailCheckData.message || `This email is already registered with another university portal. Please use a different email or sign in to your existing account.`,
            });
            setLoading(false);
            return;
          }
        } catch (err: any) {
          console.error('Error checking email availability:', err);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not verify email availability. Please try again.',
          });
          setLoading(false);
          return;
        }
        // ===== END CRITICAL CHECK =====

        // Persist the intended university so the onAuthStateChanged hook can use it
        try {
          setPendingUniversity(university);
        } catch (err) {
          console.warn('Could not set pending_university in localStorage', err);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;

        // Send signup OTP to email
        try {
          const otpResponse = await fetch('/api/send-signup-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              email: values.email,
              university,
            }),
          });

          if (!otpResponse.ok) {
            const otpError = await otpResponse.json();
            throw new Error(otpError?.error || 'Failed to send verification code');
          }

          const otpData = await otpResponse.json();

          // Sign out in background so redirect to verification page is instant.
          void signOut(auth).catch((err) => {
            console.warn('Failed to sign out after registration:', err);
          });

          // Show dev OTP if available
          if (otpData.otp) {
            console.log('Dev Mode - OTP:', otpData.otp);
            toast({
              title: 'Dev Mode: OTP Ready',
              description: `OTP: ${otpData.otp} (check console and Firestore)`,
            });
          } else {
            toast({
              title: 'Verification code sent',
              description: `Check ${values.email} for your 6-digit code.`,
            });
          }

          trackEvent('sign_up', {
            method: 'email',
            university,
          });

          // Redirect to verification page
          router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}&university=${university}&uid=${user.uid}`);
        } catch (err: any) {
          console.error('Error sending OTP:', err);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: err?.message || 'Could not send verification code. Please try again.',
          });
        }

      } else {
        // Login: sign in, then verify that the signed-in user belongs to the selected university
        const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
        const u = cred.user;

        // Perform a single admin check to determine admin status and any
        // administrative flags. Use that result to decide whether an
        // unverified admin may bypass email verification.
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available.' });
          return;
        }

        const selectedUni = university; // form prop

        // Check if this account is a server-registered admin. Admins are
        // allowed to sign in from any portal and — by design — may bypass
        // email verification. We consider any `isAdmin` truthy result from
        // the server endpoint as sufficient to grant this exception.
        let isAdminAccount = false;
        // Quick client-side admin override using NEXT_PUBLIC_ADMIN_EMAILS (dev convenience).
        try {
          const adminList = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (u.email && adminList.includes(u.email.toLowerCase())) {
            isAdminAccount = true;
          }
        } catch (e) {
          // ignore
        }
        
        // ===== CRITICAL: Check university membership FIRST before any other checks =====
        // This prevents login from wrong university portal
        let serverResult: any = null;
        try {
          const idToken = await u.getIdToken();
          const res = await fetch('/api/admin/isMember', { method: 'POST', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedUni }) });
          if (res.ok) {
            serverResult = await res.json();
            // Also update admin status from server result
            if (!isAdminAccount && serverResult?.isAdmin) {
              isAdminAccount = true;
            }
          }
        } catch (err) {
          console.error('Error checking admin status:', err);
        }

        // ===== CRITICAL: Validate university consistency during login =====
        // If user is registered under a DIFFERENT university, block immediately
        // Do NOT proceed to email verification or OTP - just show error and stay on login page
        if (serverResult && serverResult.isMember && serverResult.university !== selectedUni) {
          console.error(`SECURITY: University mismatch during login! User belongs to ${serverResult.university}, attempted login on ${selectedUni}`);
          try { await signOut(auth); } catch (e) { /* ignore */ }
          const registeredUni = serverResult.registeredIn || serverResult.university;
          const uniName = registeredUni === 'fast' ? 'FAST University' : registeredUni === 'karachi' ? 'Karachi University' : 'NED University';
          toast({ 
            variant: 'destructive', 
            title: 'Wrong University Portal', 
            description: `This email is registered with ${uniName} portal. Please sign in through the correct university portal.` 
          });
          setLoading(false);
          return; // CRITICAL: Stop here, do NOT redirect to verify page
        }
        // ===== END CRITICAL UNIVERSITY VALIDATION =====

        // ===== CRITICAL SECURITY: ENFORCE EMAIL VERIFICATION =====
        // BLOCK ALL UNVERIFIED USERS FROM SIGNING IN (except admins)
        // This is the FIRST check after authentication - before any other logic
        try {
          let emailVerifiedFlag = false;
          let userExistsInSelectedUni = false;
          const uniUserRef = doc(firestore, 'universities', selectedUni, 'users', u.uid);
          const uniUserSnap = await getDoc(uniUserRef);
          if (uniUserSnap.exists()) {
            userExistsInSelectedUni = true;
            const profile = uniUserSnap.data() as any;

            if (!isAdminAccount) {
              const lockState = getAccountLockState(profile);
              if (lockState.locked) {
                if (lockState.shouldPersistLock && lockState.lockUntil) {
                  try {
                    await updateDoc(uniUserRef, {
                      accountLockUntil: toFirestoreLockTimestamp(lockState.lockUntil),
                      accountLockDays: 7,
                      accountLockReason: 'many_cancellations',
                    });
                  } catch (lockErr) {
                    console.error('[AUTH] Failed to persist account lock:', lockErr);
                  }
                }

                try {
                  await signOut(auth);
                } catch (_) {}

                toast({
                  variant: 'destructive',
                  title: 'Account Locked',
                  description: lockState.message || 'Your account is locked due to multiple cancellations.',
                });
                setLoading(false);
                return;
              }
            }

            emailVerifiedFlag = Boolean(profile?.universityEmailVerified || profile?.emailVerified);
          }

          // If user does NOT have a university profile yet, force verification flow
          if (!userExistsInSelectedUni && !isAdminAccount) {
            try {
              await signOut(auth);
            } catch (_) {}

            try {
              const otpResponse = await fetch('/api/send-signup-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: u.uid, email: values.email, university: selectedUni }),
              });
              const otpData = await otpResponse.json().catch(() => ({}));
              if (otpResponse.ok) {
                toast({
                  variant: 'destructive',
                  title: 'Email Verification Required',
                  description: otpData?.otp
                    ? `Dev: OTP ${otpData.otp} - Check your email to verify your account.`
                    : `Please verify your email before signing in. We've sent a new code to ${values.email}.`
                });
              } else {
                toast({
                  variant: 'destructive',
                  title: 'Email Verification Required',
                  description: 'Your email is not verified. Please check your inbox for the verification code.'
                });
              }
            } catch (_) {
              toast({
                variant: 'destructive',
                title: 'Email Verification Required',
                description: 'You must verify your email before signing in. Please check your inbox.'
              });
            }

            router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}&university=${selectedUni}&uid=${u.uid}`);
            setLoading(false);
            return;
          }

          // CRITICAL: If user EXISTS but email is NOT verified, BLOCK login completely
          // Do NOT create session, Do NOT issue tokens, Do NOT redirect to dashboard
          if (userExistsInSelectedUni && !isAdminAccount && !emailVerifiedFlag) {
            // Sign out immediately - do not allow user to stay logged in
            try { 
              await signOut(auth); 
              console.log('[AUTH] Blocked unverified user login attempt:', u.email);
            } catch (e) { 
              console.error('[AUTH] Failed to sign out unverified user:', e);
            }
            
            // Send new OTP for verification
            try {
              const otpResponse = await fetch('/api/send-signup-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: u.uid, email: values.email, university: selectedUni }),
              });
              const otpData = await otpResponse.json().catch(() => ({}));
              if (otpResponse.ok) {
                toast({ 
                  variant: 'destructive',
                  title: 'Email Verification Required', 
                  description: otpData?.otp 
                    ? `Dev: OTP ${otpData.otp} - Check your email to verify your account.` 
                    : `Please verify your email before signing in. We've sent a new code to ${values.email}.` 
                });
              } else {
                toast({ 
                  variant: 'destructive', 
                  title: 'Email Verification Required', 
                  description: 'Your email is not verified. Please check your inbox for the verification code.' 
                });
              }
            } catch (_) {
              toast({ 
                variant: 'destructive', 
                title: 'Email Verification Required', 
                description: 'You must verify your email before signing in. Please check your inbox.' 
              });
            }
            
            // ALWAYS redirect to verification page - do not allow access to dashboard
            router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}&university=${selectedUni}&uid=${u.uid}`);
            setLoading(false);
            return; // CRITICAL: Stop execution here
          }
        } catch (e) {
          console.error('[AUTH] Failed to check email verification status:', e);
          // If verification check fails, err on the side of caution - require verification
          try { await signOut(auth); } catch (err) { /* ignore */ }
          toast({ 
            variant: 'destructive', 
            title: 'Verification Check Failed', 
            description: 'Please try signing in again or contact support.' 
          });
          setLoading(false);
          return;
        }
        // ===== END CRITICAL SECURITY CHECK =====


        // Check for an existing user document under the university-specific path
        // `users/{university}/{uid}`. This enforces university scoping and prevents
        // cross-university sign-ins.
        // NOTE: We already have serverResult from above, reuse it
        try {
          console.debug('University membership check: uid=', u?.uid, 'selectedUni=', selectedUni, 'serverResult=', serverResult);

          if (serverResult && serverResult.isMember) {
            const memberUni = serverResult.university || selectedUni;
            if (memberUni === selectedUni) {
              // Read the user's university-scoped profile to determine completeness.
              try {
                const userProfileSnap = await getDoc(doc(firestore, 'universities', memberUni, 'users', u.uid));
                const profile = userProfileSnap.exists() ? (userProfileSnap.data() as any) : null;
                const complete = profile && profile.fullName && profile.gender && profile.contactNumber && profile.university;
                if (!complete) {
                  // Profile incomplete but still redirect to dashboard - user can complete later
                  toast({ title: 'Signed In', description: 'Welcome! You can complete your profile from the dashboard.' });
                    await pushPreferredDashboard(u.uid, selectedUni);
                  return;
                }
              } catch (e) {
                // If reading the profile fails for any reason, fall back to dashboard but log for debugging
                console.debug('Failed to read user profile for completeness check:', e);
              }
              toast({ title: 'Signed In', description: 'Welcome back!' });
              trackEvent('login', {
                method: 'email',
                university: selectedUni,
              });
              try {
                const pending = getPendingBooking();
                if (pending && pending.rideId && pending.university && pending.university === selectedUni) {
                  clearPendingBooking();
                  router.push(`/dashboard/rides?pendingBooking=${encodeURIComponent(pending.rideId)}`);
                  return;
                }
              } catch (e) {}
              await pushPreferredDashboard(u.uid, selectedUni);
              return;
            }

            // Member exists but under the other university
            if (!isAdminAccount) {
              try { await signOut(auth); } catch (e) { /* ignore */ }
              const registeredUni = serverResult.registeredIn || serverResult.university;
              const uniName = registeredUni === 'fast' ? 'FAST University' : registeredUni === 'karachi' ? 'Karachi University' : 'NED University';
              toast({ 
                variant: 'destructive', 
                title: 'Account Already Exists', 
                description: `This email is registered with ${uniName} portal. Please sign in to the correct university portal or use a different email.` 
              });
              return;
            }

            // Admin logging in from a different portal: attempt to create a profile for the selected university (best-effort)
            try {
              await setDoc(doc(firestore, 'universities', selectedUni, 'users', u.uid), { email: u.email || null, university: selectedUni, createdAt: serverTimestamp() });
              toast({ title: 'Signed In', description: 'Admin access granted.' });
              await pushPreferredDashboard(u.uid, selectedUni);
              return;
            } catch (e) {
              console.warn('Failed to create admin profile under selected university:', e);
              try { await signOut(auth); } catch (e) {}
              toast({ variant: 'destructive', title: 'Account Error', description: 'Could not finalize admin sign-in. Contact support.' });
              return;
            }
          }
          // Determine the final university to create the profile under. Default
          // to the selected portal but allow a pending value set during
          // registration to override it.
          let finalUniversity: 'ned' | 'fast' | 'karachi' = selectedUni as 'ned' | 'fast' | 'karachi';
          try {
            const pending = getPendingUniversity();
            if (isValidUniversity(pending)) finalUniversity = pending as 'ned' | 'fast' | 'karachi';
          } catch (_) {}

          // Only create the profile for the university the user is currently
          // attempting to sign in to (or the pending university). This prevents
          // accidental cross-university creation.
          if (finalUniversity !== selectedUni) {
            // user trying to sign in to a different portal than the one they registered with
            try { await signOut(auth); } catch (e) { /* ignore */ }
            toast({ variant: 'destructive', title: 'Wrong University', description: 'Please sign up first with your university.' });
            return;
          }

          // Create the university-scoped user profile using pending gender when available.
            try {
              const pendingGender = getPendingGender();
              // Build canonical profile for universities/{univ}/users/{uid}
              const profile = {
                uid: u.uid,
                name: u.displayName || '',
                email: u.email || null,
                university: finalUniversity,
                role: 'passenger' as const,
                createdAt: serverTimestamp(),
                ...(pendingGender ? { gender: pendingGender } : {}),
              };
              // Create canonical university-scoped user document only. Do NOT create legacy flat docs.
              await setDoc(doc(firestore, 'universities', finalUniversity, 'users', u.uid), profile, { merge: false });
              console.debug('Created canonical university-scoped users document for', u.uid, 'under', finalUniversity);
              try { clearPendingUniversity(); clearPendingGender(); } catch (_) {}
            // Resume pending booking if applicable
            try {
              const pending = getPendingBooking();
              if (pending && pending.rideId && pending.university && pending.university === finalUniversity) {
                clearPendingBooking();
                toast({ title: 'Signed In', description: 'Welcome! Redirecting to resume booking.' });
                trackEvent('login', {
                  method: 'email',
                  university: finalUniversity,
                });
                router.push(`/dashboard/rides?pendingBooking=${encodeURIComponent(pending.rideId)}`);
                return;
              }
            } catch (e) {}
            // Profile created - go straight to dashboard
            toast({ title: 'Signed In', description: 'Welcome! You can complete your profile from the dashboard.' });
            trackEvent('login', {
              method: 'email',
              university: finalUniversity,
            });
            await pushPreferredDashboard(u.uid, finalUniversity);
            return;
          } catch (e) {
            console.warn('Failed to create university-scoped profile during login fallback:', e);
            try { await signOut(auth); } catch (e) { /* ignore */ }
            toast({ variant: 'destructive', title: 'Account Missing', description: `Please sign up as a ${universityConfig[selectedUni].name} student first.` });
            return;
          }
        } catch (docErr: any) {
          console.error('University membership check failed:', docErr);
          try { await signOut(auth); } catch (e) { /* ignore */ }
          // Show a slightly more detailed message in development to aid debugging.
          const baseMsg = 'Could not verify your university membership. Please check your selected university and try again.';
          const devDetail = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') ? ` (${docErr?.message || JSON.stringify(docErr)})` : '';
          toast({ variant: 'destructive', title: 'Verification Failed', description: baseMsg + devDetail });
          return;
        }
        
      }
    } catch (error: any) {
      const errorCode = error.code;
      let errorMessage = "An unknown error occurred.";
      if (errorCode === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please sign in or use a different email.';
      } else if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorMessage,
      });
    } finally {
      console.log('[AuthForm][perf] action=', action, 'university=', university, 'total_ms=', Math.round(performance.now() - submitStartMs));
      actionFeedback.clear();
      setLoading(false);
    }
  }
  
  const isLogin = action === 'login';

  return (
    <Card className="w-full max-w-md border-primary/25 bg-card/80 shadow-2xl backdrop-blur-xl hover-card-lift soft-shadow animate-fade-slide">
      <CardHeader className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <ShieldCheck className="h-4 w-4" />
          Secure portal
        </div>
        <CardTitle className="font-headline text-3xl leading-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
        <CardDescription>
          {isLogin ? 'Sign in to your' : 'Create an account for'} {config.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isLogin && (
              <>
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Gender is intentionally collected in Complete Profile, not at registration */}
              </>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder={`yourname@example.com`} {...field} />
                  </FormControl>
                
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isLogin && (
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={!!field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-2"
                        />
                        <span className="text-sm">
                          I confirm that I have read, understood, and agree to the <Link href="/terms" className="text-accent underline">Terms & Regulations and Privacy Policy</Link> of this University Car Pooling Application.
                        </span>
                      </label>
                    </FormControl>
                    <FormMessage />
                    <p className="mt-2 text-xs text-muted-foreground">
                      By registering, you voluntarily accept all responsibilities, risks, and obligations described in this document without limitation.
                    </p>
                  </FormItem>
                )}
              />
            )}
            {isLogin && (
              <div className="text-right text-sm mt-1">
                <Link href="/auth/forgot-password" className="text-accent hover:underline">Forgot password?</Link>
              </div>
            )}
            
            <Button type="submit" className="w-full rounded-full px-6" size="lg" disabled={loading || (!isLogin && !form.watch('consent'))}>
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight />
                </>
              )}
            </Button>

            <>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                size="lg"
                onClick={onGoogleSignIn}
                disabled={loading || (!isLogin && !form.watch('consent'))}
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-semibold">G</span>
                {isLogin ? 'Sign in with Google' : 'Continue with Google'}
              </Button>
            </>
          </form>
        </Form>
        <div className="mt-6 text-center text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <Button variant="link" asChild>
            <Link href={`/auth/${university}/${isLogin ? 'register' : 'login'}`}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
