import { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'About Campus Ride | Trust-first student carpooling',
  description:
    'Discover why Campus Ride exists, our mission to serve students, and how we build trust through verified, premium ride-sharing experiences.',
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
