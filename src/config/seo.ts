import type { Metadata } from 'next';

export const SITE_URL = 'https://campusrides.virtual.app';

export const SEO_TARGET_KEYWORDS = [
  'Fast University carpool',
  'FAST carpool',
  'NED University carpool',
  'NED carpool',
  'Karachi University carpool',
  'University of Karachi carpool',
  'Karachi carpool',
];

export type SeoPageConfig = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
};

export const SEO_PAGES: SeoPageConfig[] = [
  {
    path: '/',
    title: 'Campus Ride | FAST, NED & Karachi University Carpool',
    description:
      'Campus Ride helps students find safe, affordable university carpools for FAST, NED, and Karachi University routes.',
    keywords: [...SEO_TARGET_KEYWORDS, 'student ride sharing Karachi', 'university ride app Pakistan'],
  },
  {
    path: '/rides',
    title: 'Find University Carpools in Karachi | Campus Ride',
    description:
      'Browse verified student carpools for FAST University, NED University, and University of Karachi with real-time seat availability.',
    keywords: [...SEO_TARGET_KEYWORDS, 'find carpool Karachi university'],
  },
  {
    path: '/how-it-works',
    title: 'How Campus Ride Works | University Carpool Safety Flow',
    description:
      'See how Campus Ride manages booking, acceptance, confirmation, ride start, completion, and safety checks for university carpools.',
    keywords: ['university carpool process', ...SEO_TARGET_KEYWORDS],
  },
  {
    path: '/about',
    title: 'About Campus Ride | Student Carpool Platform',
    description:
      'Learn how Campus Ride builds trusted, university-only carpools for students in Karachi.',
    keywords: ['student carpool platform', ...SEO_TARGET_KEYWORDS],
  },
  {
    path: '/contact-us',
    title: 'Contact Campus Ride | University Carpool Support',
    description:
      'Contact Campus Ride support for FAST, NED, and Karachi University carpool help.',
    keywords: ['carpool support', ...SEO_TARGET_KEYWORDS],
  },
];

export function getSeoPage(path: string): SeoPageConfig | undefined {
  return SEO_PAGES.find((page) => page.path === path);
}

export function buildSeoMetadata(path: string): Metadata {
  const page = getSeoPage(path);
  if (!page) {
    return {
      metadataBase: new URL(SITE_URL),
      robots: {
        index: true,
        follow: true,
      },
    };
  }

  const absoluteUrl = `${SITE_URL}${page.path}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      type: 'website',
      url: absoluteUrl,
      title: page.title,
      description: page.description,
      siteName: 'Campus Ride',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
