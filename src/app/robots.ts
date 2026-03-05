import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/rides', '/how-it-works', '/about', '/contact-us', '/terms'],
        disallow: [
          '/dashboard/',
          '/auth/',
          '/admin-dashboard/',
          '/debug/',
          '/api/',
          '/report/',
          '/unauthorized/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
