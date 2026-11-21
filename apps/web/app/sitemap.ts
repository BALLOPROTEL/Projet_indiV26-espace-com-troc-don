import type { MetadataRoute } from 'next';
import { getPublicListings } from '../lib/server-listings';
import { getSiteUrl } from '../lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const listings = await getPublicListings();
  const staticPaths = [
    'boutique',
    'echanges',
    'fanzines',
    'festival',
    'faq',
    'notre-histoire',
    'contact',
  ];

  return [
    {
      url: siteUrl.href,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...staticPaths.map((path) => ({
      url: new URL('/' + path, siteUrl).href,
      changeFrequency: 'weekly' as const,
      priority: path === 'echanges' ? 0.9 : 0.7,
    })),
    ...(listings ?? []).map((listing) => ({
      url: new URL(
        `/annonces/${encodeURIComponent(listing.id)}`,
        siteUrl,
      ).href,
      lastModified: new Date(listing.updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
