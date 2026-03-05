import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildSeoMetadata } from '@/config/seo';

export const metadata: Metadata = buildSeoMetadata('/contact-us');

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
