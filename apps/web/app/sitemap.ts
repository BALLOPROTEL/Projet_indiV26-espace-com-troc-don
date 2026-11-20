import type { MetadataRoute } from 'next';
import { getPublicListings } from '../lib/server-listings';
import { getSiteUrl } from '../lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const listings = await getPublicListings();

  return [
    {
      url: siteUrl.href,
      changeFrequency: 'weekly',
      priority: 1,
    },
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
