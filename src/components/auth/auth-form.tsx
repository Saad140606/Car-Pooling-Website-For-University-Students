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
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { setPendingUniversity, setPendingGender, getPendingUniversity, getPendingGender, clearPendingUniversity, clearPendingGender, isValidUniversity } from "@/lib/university";

import { ArrowRight, Loader2 } from "lucide-react";

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
    gender: action === 'register' ? z.enum(['male','female']) : z.optional(z.enum(['male','female'])),
    consent: action === 'register' ? z.boolean().refine(v => v === true, { message: 'You must accept the Terms & Regulations and Privacy Policy to register.' }) : z.optional(z.boolean()),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      gender: undefined as any,
      consent: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
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
        // Persist the intended university and selected gender so the onAuthStateChanged hook can use them
        try {
          setPendingUniversity(university);
          // @ts-ignore - form value exists when registering
          if (values && (values as any).gender) {
            setPendingGender((values as any).gender);
          }
        } catch (err) {
          console.warn('Could not set pending_university/pending_gender in localStorage', err);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;

        // Send verification email. We *do not* create the users/{uid} profile until the email is verified.
        try {
          await sendEmailVerification(user);
          toast({
            title: "Verification Sent",
            description: "A verification email has been sent. Please check your inbox (and spam) and verify your email before signing in.",
          });
        } catch (err) {
          console.warn('Failed to send verification email', err);
          toast({
            variant: 'destructive',
            title: 'Verification Failed',
            description: 'Could not send verification email. Please try signing up again or contact support.',
          });
        }

        // Sign the ephemeral account out so the user must verify and then sign in again (this avoids unverified profiles being active)
        try {
          await signOut(auth);
        } catch (err) {
          console.warn('Failed to sign out after registration:', err);
        }

        // Redirect to login so user can sign in after verification
        router.push(`/auth/${university}/login`);

      } else {
        // Login: sign in, then verify that the signed-in user belongs to the selected university
        const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
        const u = cred.user;

        // Require email verification before allowing a login to proceed.
        // If the user hasn't verified their email, sign them out and instruct them to verify first.
        if (!u.emailVerified) {
          try { await signOut(auth); } catch (e) { /* ignore */ }
          toast({ variant: 'destructive', title: 'Email Not Verified', description: 'Please verify your email address before signing in. Check your inbox (and spam) for the verification email.' });
          return;
        }
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available.' });
          return;
        }

        const selectedUni = university; // form prop
        const otherUni = selectedUni === 'ned' ? 'fast' : 'ned';

        // Check for an existing user document under the university-specific path
        // `users/{university}/{uid}`. This enforces university scoping and prevents
        // cross-university sign-ins.
        try {
          const uniDocRef = doc(firestore, 'users', `${selectedUni}_${u.uid}`);
          const otherDocRef = doc(firestore, 'users', `${otherUni}_${u.uid}`);

          const uniSnap = await getDoc(uniDocRef);
          const otherSnap = await getDoc(otherDocRef);

          if (uniSnap.exists()) {
            // User exists under selected university — allow sign-in
            toast({ title: 'Signed In', description: 'Welcome back!' });
            router.push('/dashboard/rides');
            return;
          }

          if (otherSnap.exists()) {
            // User belongs to the other university — block sign-in
            try { await signOut(auth); } catch (e) { /* ignore */ }
            toast({ variant: 'destructive', title: 'Wrong University', description: 'Please sign up first with your university.' });
            return;
          }

          // No university-scoped profile exists. Attempt a safe fallback: if there
          // was a pending university set at registration time, create the profile
          // under the expected university (this is the case when the onAuth
          // handler didn't run earlier). Otherwise, require sign-up.
          let finalUniversity = selectedUni;
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
            const profile: any = { email: u.email || null, university: finalUniversity, createdAt: serverTimestamp() };
            if (pendingGender) profile.gender = pendingGender;
            await setDoc(doc(firestore, 'users', `${finalUniversity}_${u.uid}`), profile);
            try { clearPendingUniversity(); clearPendingGender(); } catch (_) {}
            toast({ title: 'Signed In', description: 'Welcome! Your account has been set up.' });
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
          toast({ variant: 'destructive', title: 'Verification Failed', description: 'Could not verify your university membership. Please check your selected university and try again.' });
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
    <Card className="w-full max-w-md bg-card/50 backdrop-blur-lg border-primary/20">
      <CardHeader>
        <CardTitle className="font-headline text-3xl">{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
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
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender (select carefully, cannot be changed later)</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
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
            
            <Button type="submit" className="w-full" size="lg" disabled={loading || (!isLogin && !form.watch('consent'))}>
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
