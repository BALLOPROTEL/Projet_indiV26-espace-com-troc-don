import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: siteUrl.href,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...['boutique', 'echanges', 'fanzines', 'festival'].map((path) => ({
      url: new URL('/' + path, siteUrl).href,
      changeFrequency: 'weekly' as const,
      priority: path === 'echanges' ? 0.9 : 0.7,
    })),
  ];
}
