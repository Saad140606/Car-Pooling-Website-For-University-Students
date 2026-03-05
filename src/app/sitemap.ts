import type { MetadataRoute } from 'next';
import { SEO_PAGES, SITE_URL } from '@/config/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return SEO_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.path === '/' ? 'daily' : 'weekly',
    priority: page.path === '/' ? 1 : 0.7,
  }));
}
