import Link from "next/link";
import { Car } from "lucide-react";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Car className="h-7 w-7 text-primary" />
      <span className="font-headline text-2xl font-bold">Campus Cruiser</span>
    </Link>
  );
}
