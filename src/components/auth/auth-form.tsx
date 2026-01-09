"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
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
        // Persist the intended university so the onAuthStateChanged hook can use it when creating missing user docs
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('pending_university', university);
          }
        } catch (err) {
          console.warn('Could not set pending_university in localStorage', err);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;

        // Send verification email. We *do not* create the users/{uid} profile until the email is verified.
        try {
          await sendEmailVerification(user);
          toast({
            title: "Verification Sent",
            description: "A verification email was sent to your inbox. Please verify your email before signing in.",
          });
        } catch (err) {
          console.warn('Failed to send verification email', err);
          toast({
            variant: 'destructive',
            title: 'Verification Failed',
            description: 'Could not send verification email. Please try signing in or contact support.',
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
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({
          title: "Signed In",
          description: "Welcome back!",
        });
        router.push("/dashboard/rides");
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
