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
          '/publier',
          '/publier/',
          '/mes-annonces',
          '/mes-annonces/',
          '/messages',
          '/messages/',
          '/silent-check-sso.html',
        ],
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).href,
  };
}
