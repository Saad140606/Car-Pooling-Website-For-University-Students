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
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

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
    email: z.string().email().refine(
      (email) => email.endsWith(`@${config.domain}`),
      { message: `Email must be a valid @${config.domain} address.` }
    ),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    fullName: action === 'register' ? z.string().min(3, { message: "Full name is required."}) : z.optional(z.string()),
    gender: action === 'register' ? z.enum(["male", "female"]) : z.optional(z.enum(["male", "female"])),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
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
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        await setDoc(doc(firestore, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          fullName: values.fullName,
          university: university,
          gender: values.gender,
          createdAt: new Date(),
        });
        toast({
          title: "Account Created",
          description: "Welcome to Campus Cruiser!",
        });
        router.push("/dashboard/rides");
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
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                         <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>University Email</FormLabel>
                  <FormControl>
                    <Input placeholder={`yourname@${config.domain}`} {...field} />
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
            
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
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
