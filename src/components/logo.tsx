import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image src="/campus-rides-logo.png" alt="Campus Ride" width={40} height={40} className="object-contain" />
      <span className="font-headline text-2xl font-bold">Campus Ride</span>
    </Link>
  );
}
