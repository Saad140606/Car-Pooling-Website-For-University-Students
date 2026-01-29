"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setSelectedUniversity } from "@/lib/university";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";
import Logo from "@/components/logo";
import { Reveal } from "@/components/Reveal";

const universities = [
  {
    name: "NED University",
    slug: "ned",
    image: PlaceHolderImages.find(img => img.id === "ned-university-campus"),
  },
  {
    name: "FAST University",
    slug: "fast",
    image: PlaceHolderImages.find(img => img.id === "fast-university-campus"),
  },
];

export default function SelectUniversityPage() {
  const router = useRouter();

  function goToUniversity(slug: string) {
    try { setSelectedUniversity(slug as any); } catch (e) { /* ignore */ }
    router.push(`/auth/${slug}/login`);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground animate-page-rise">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-50 animate-float" aria-hidden />
      <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-40 animate-float" style={{ animationDelay: '1s' }} aria-hidden />

      <div className="mb-10 flex items-center justify-center">
        <Logo />
      </div>

      <Reveal className="text-center space-y-3">
        <h1 className="font-headline text-4xl sm:text-5xl text-slate-50">Select Your University</h1>
        <p className="max-w-2xl text-slate-300">Choose your university to sign in or create an account.</p>
      </Reveal>

      <div className="mt-10 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {universities.map((uni, idx) => (
          <Reveal key={uni.slug} delay={idx * 90} className="group">
            <button onClick={() => goToUniversity(uni.slug)} className="w-full text-left">
              <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-2xl shadow-primary/10 hover-card-lift transition-all duration-300 hover:shadow-primary/30">
                <div className="relative h-60 w-full">
                  {uni.image && (
                    <Image
                      src={uni.image.imageUrl}
                      alt={uni.image.description}
                      fill
                      className="object-cover"
                      data-ai-hint={uni.image.imageHint}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <h2 className="font-headline text-3xl font-bold text-white drop-shadow-md">{uni.name}</h2>
                    <p className="text-sm text-white/80">Tap to continue</p>
                  </div>
                </div>
                <CardContent className="flex items-center justify-between bg-card/80 p-4">
                  <p className="font-semibold text-primary">Proceed to {uni.name}</p>
                  <ArrowRight className="h-5 w-5 text-primary transition-transform duration-300 group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}