import { ShieldAlert } from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { Reveal } from '@/components/Reveal';
import Link from 'next/link';
import { AnimatedButton } from '@/components/AnimatedButton';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
      <div className="absolute right-0 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />
      <div className="flex-1 flex items-center justify-center relative z-10 p-8">
        <Reveal className="max-w-md text-center">
          <AnimatedCard className="border-destructive/30 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-lg shadow-2xl">
            <div className="flex flex-col items-center gap-6 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-destructive/25 to-destructive/15">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-3 text-slate-50">Unauthorized Access</h1>
                <p className="text-slate-300 text-lg mb-6">You do not have permission to access this page.</p>
              </div>
              <AnimatedButton asChild className="rounded-full shadow-lg shadow-primary/30">
                <Link href="/dashboard/rides">Return to Dashboard</Link>
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </Reveal>
      </div>
    </div>
  );
}
