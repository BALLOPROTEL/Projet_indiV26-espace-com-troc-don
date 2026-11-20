import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/espace',
          '/espace/',
          '/moderation',
          '/moderation/',
          '/silent-check-sso.html',
        ],
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).href,
  };
}
