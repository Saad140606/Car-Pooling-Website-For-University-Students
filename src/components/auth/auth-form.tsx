"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { setPendingUniversity, getPendingUniversity, getPendingGender, clearPendingUniversity, clearPendingGender, isValidUniversity } from "@/lib/university";
import { getPendingBooking, clearPendingBooking } from '@/lib/bookings';

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
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type AuthFormProps = {
  university: "ned" | "fast";
  action: "login" | "register";
};

const universityConfig = {
  ned: { name: "NED University", domain: "neduet.edu.pk" },
  fast: { name: "FAST University", domain: "nu.edu.pk" },
};

export function AuthForm({ university, action }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

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

  async function onSubmit(values: AuthFormValues) {
    setLoading(true);
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
              description: emailCheckData.message || `This email is already registered with another university. Please use a different email or sign in to your existing account.`,
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
          
          // Sign out before redirecting to verify page
          try {
            await signOut(auth);
          } catch (err) {
            console.warn('Failed to sign out after registration:', err);
          }

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
        const otherUni = selectedUni === 'ned' ? 'fast' : 'ned';

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
        try {
          // If not already flagged by client-side admin list, verify with server.
          if (!isAdminAccount) {
            const idToken = await u.getIdToken();
            const admRes = await fetch('/api/admin/isMember', { method: 'POST', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedUni }) });
            if (admRes.ok) {
              const jb = await admRes.json();
              isAdminAccount = Boolean(jb?.isAdmin);
            }
          }
        } catch (e) {
          console.debug('Admin check failed during login:', e);
        }

        // Enforce signup email verification before allowing login (except admins)
        try {
          let emailVerifiedFlag = false;
          const uniUserSnap = await getDoc(doc(firestore, 'universities', selectedUni, 'users', u.uid));
          if (uniUserSnap.exists()) {
            const profile = uniUserSnap.data() as any;
            emailVerifiedFlag = Boolean(profile?.emailVerified);
          }

          if (!isAdminAccount && !emailVerifiedFlag) {
            try {
              const otpResponse = await fetch('/api/send-signup-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: u.uid, email: values.email, university: selectedUni }),
              });
              const otpData = await otpResponse.json().catch(() => ({}));
              if (otpResponse.ok) {
                toast({ title: 'Verify your email', description: otpData?.otp ? `Dev: OTP ${otpData.otp}` : `We sent a 6-digit code to ${values.email}.` });
              } else {
                toast({ variant: 'destructive', title: 'Verification required', description: String(otpData?.error || 'Could not send code. Please try again.') });
              }
            } catch (_) {
              toast({ variant: 'destructive', title: 'Verification required', description: 'Could not send code. Please try again.' });
            }
            try { await signOut(auth); } catch (e) { /* ignore */ }
            router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}&university=${selectedUni}&uid=${u.uid}`);
            return;
          }
        } catch (e) {
          // If we fail to read the profile, be safe and require verification
          if (!isAdminAccount) {
            try { await signOut(auth); } catch (_) {}
            router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}&university=${selectedUni}&uid=${u.uid}`);
            return;
          }
        }


        // Check for an existing user document under the university-specific path
        // `users/{university}/{uid}`. This enforces university scoping and prevents
        // cross-university sign-ins.
        try {
          // Use a server-side membership check to avoid client Firestore permission errors
          console.debug('University membership check (server): uid=', u?.uid, 'selectedUni=', selectedUni, 'otherUni=', otherUni);
          let serverResult: any = null;
          try {
            const idToken = await u.getIdToken();
            const res = await fetch('/api/admin/isMember', { method: 'POST', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedUni }) });
            if (res.ok) serverResult = await res.json();
          } catch (e) {
            console.warn('Server membership check failed:', e);
            serverResult = null;
          }

          if (serverResult && serverResult.isMember) {
            const memberUni = serverResult.university || selectedUni;
            if (memberUni === selectedUni) {
              // Read the user's university-scoped profile to determine completeness.
              try {
                const userProfileSnap = await getDoc(doc(firestore, 'universities', memberUni, 'users', u.uid));
                const profile = userProfileSnap.exists() ? (userProfileSnap.data() as any) : null;
                const complete = profile && profile.fullName && profile.gender && profile.contactNumber && profile.university;
                if (!complete) {
                  toast({ variant: 'destructive', title: 'Complete Profile', description: 'Please complete your profile before continuing. You can finish it from the dashboard.' });
                  router.push('/dashboard/rides');
                  return;
                }
              } catch (e) {
                // If reading the profile fails for any reason, fall back to dashboard but log for debugging
                console.debug('Failed to read user profile for completeness check:', e);
              }
              toast({ title: 'Signed In', description: 'Welcome back!' });
              try {
                const pending = getPendingBooking();
                if (pending && pending.rideId && pending.university && pending.university === selectedUni) {
                  clearPendingBooking();
                  router.push(`/dashboard/rides?pendingBooking=${encodeURIComponent(pending.rideId)}`);
                  return;
                }
              } catch (e) {}
              router.push('/dashboard/rides');
              return;
            }

            // Member exists but under the other university
            if (!isAdminAccount) {
              try { await signOut(auth); } catch (e) { /* ignore */ }
              const registeredUni = serverResult.registeredIn || otherUni;
              const uniName = registeredUni === 'fast' ? 'FAST University' : 'NED University';
              toast({ 
                variant: 'destructive', 
                title: 'Account Already Exists', 
                description: `This email is registered with ${uniName}. Please sign in to the correct university portal or use a different email.` 
              });
              return;
            }

            // Admin logging in from a different portal: attempt to create a profile for the selected university (best-effort)
            try {
              await setDoc(doc(firestore, 'universities', selectedUni, 'users', u.uid), { email: u.email || null, university: selectedUni, createdAt: serverTimestamp() });
              toast({ title: 'Signed In', description: 'Admin access granted.' });
              router.push('/dashboard/rides');
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
          let finalUniversity: 'ned' | 'fast' = selectedUni as 'ned' | 'fast';
          try {
            const pending = getPendingUniversity();
            if (isValidUniversity(pending)) finalUniversity = pending as 'ned' | 'fast';
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
                router.push(`/dashboard/rides?pendingBooking=${encodeURIComponent(pending.rideId)}`);
                return;
              }
            } catch (e) {}
            // After creating a minimal profile, prompt the user to finish their profile
            toast({ variant: 'destructive', title: 'Complete Profile', description: 'Please complete your profile to enable booking and rides. You can finish it from the dashboard.' });
            router.push('/dashboard/rides');
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
