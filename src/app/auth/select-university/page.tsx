import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/logo";

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
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-12">
        <Logo />
      </div>
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold">Select Your University</h1>
        <p className="mt-2 text-muted-foreground">Choose your university to sign in or create an account.</p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {universities.map((uni) => (
          <Link href={`/auth/${uni.slug}/login`} key={uni.slug} className="group">
            <Card className="overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                 <div className="absolute bottom-4 left-4">
                  <h2 className="font-headline text-3xl font-bold text-white">{uni.name}</h2>
                </div>
              </div>
              <CardContent className="p-4 bg-card flex items-center justify-between">
                <p className="font-semibold text-primary">Proceed to {uni.name}</p>
                <ArrowRight className="h-5 w-5 text-primary transition-transform duration-300 group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
