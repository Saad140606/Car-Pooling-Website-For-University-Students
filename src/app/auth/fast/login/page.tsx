'use client';
import { AuthForm } from "@/components/auth/auth-form";
import Logo from "@/components/logo";
import { Reveal } from "@/components/Reveal";

export default function FastLoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
      <div className="absolute -right-40 -bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />
      <div className="absolute top-8 left-8">
        <Logo />
      </div>
      <Reveal className="w-full max-w-md px-4">
        <AuthForm university="fast" action="login" />
      </Reveal>
    </main>
  );
}
