'use client';
import { AuthForm } from "@/components/auth/auth-form";
import Logo from "@/components/logo";
import { FirebaseProvider } from "@/firebase/provider";

export default function FastLoginPage() {
  return (
    <FirebaseProvider>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="absolute top-8 left-8">
          <Logo />
        </div>
        <AuthForm university="fast" action="login" />
      </main>
    </FirebaseProvider>
  );
}
