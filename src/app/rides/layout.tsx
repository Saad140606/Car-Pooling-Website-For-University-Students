import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildSeoMetadata } from '@/config/seo';

export const metadata: Metadata = buildSeoMetadata('/rides');

export default function RidesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
