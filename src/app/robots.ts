import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/rides',
          '/how-it-works',
          '/about',
          '/contact-us',
          '/terms',
          '/auth/select-university',
          '/auth/fast/login',
          '/auth/fast/register',
          '/auth/ned/login',
          '/auth/ned/register',
          '/auth/karachi/login',
          '/auth/karachi/register',
        ],
        disallow: [
          '/dashboard/',
          '/auth/forgot-password',
          '/auth/reset-password/',
          '/auth/verify-email',
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
