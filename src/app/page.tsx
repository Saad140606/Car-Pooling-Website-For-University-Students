import Link from 'next/link';
import { Car, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Logo from '@/components/logo';

export default function Home() {
  const features = [
    {
      icon: <Car className="h-10 w-10 text-accent" />,
      title: 'University-Only Rides',
      description: 'Share rides exclusively with verified students and faculty from your university.',
    },
    {
      icon: <ShieldCheck className="h-10 w-10 text-accent" />,
      title: 'Safety First',
      description: 'Gender-based filtering, real-time location sharing, and user reporting for a secure journey.',
    },
    {
      icon: <Users className="h-10 w-10 text-accent" />,
      title: 'Community Driven',
      description: 'Connect with fellow university members, save money, and reduce your carbon footprint.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Logo />
          <nav>
            <Link href="/contact-us" className="text-sm font-medium text-muted-foreground hover:underline">Contact</Link>
          </nav>
        </div>
      </header>
      <main className="flex-grow">
        <section className="container mx-auto flex flex-col items-center justify-center px-4 py-20 text-center sm:py-32">
          <h1 className="font-headline text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl">
            Your Campus, Your Commute.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Affordable, safe, and convenient carpooling for university students. Find or offer a ride within your trusted campus community.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Button asChild size="xl" aria-label="Find a Ride">
              <Link href="/rides">Find a Ride</Link>
            </Button>

            <div className="mt-2">
              <Button asChild variant="ghost" size="lg" aria-label="Get Started">
                <Link href="/auth/select-university" className="inline-flex items-center gap-2">
                  Get Started
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
        
        <section id="features" className="bg-background/80 py-20 sm:py-24">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-center text-4xl font-bold">Why Campus Ride?</h2>
            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-card/50 backdrop-blur-lg border-primary/20 text-center">
                  <CardHeader>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                      {feature.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="font-headline text-2xl">{feature.title}</CardTitle>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="container mx-auto px-4 py-6 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <p>&copy; {new Date().getFullYear()} Campus Ride. All rights reserved.</p>
          <Link href="/contact-us" className="text-sm hover:underline">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
