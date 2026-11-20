import { cache } from 'react';
import type { Listing } from './types';

export type PublicListingLookup =
  | { kind: 'found'; listing: Listing }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

export function publicListingAssetUrl(contentUrl: string): string {
  if (/^https?:\/\//.test(contentUrl)) {
    return contentUrl;
  }

  const publicApi =
    process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3000/api';

  if (/^https?:\/\//.test(publicApi)) {
    return new URL(contentUrl, new URL(publicApi).origin).href;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3001';

  return new URL(contentUrl, siteUrl).href;
}

function publicApiBaseUrl(): string {
  const internal = process.env.API_INTERNAL_URL?.trim();
  if (internal) {
    return `${internal.replace(/\/$/, '')}/api`;
  }

  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi && /^https?:\/\//.test(publicApi)) {
    return publicApi.replace(/\/$/, '');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl && /^https?:\/\//.test(siteUrl)) {
    return new URL(publicApi || '/api', siteUrl).href.replace(/\/$/, '');
  }

  return 'http://localhost:3000/api';
}

export const getPublicListing = cache(
  async (id: string): Promise<PublicListingLookup> => {
    try {
      const response = await fetch(
        `${publicApiBaseUrl()}/listings/${encodeURIComponent(id)}`,
        {
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        },
      );

      if (response.status === 404) {
        return { kind: 'not-found' };
      }

      if (!response.ok) {
        return { kind: 'unavailable' };
      }

      return {
        kind: 'found',
        listing: (await response.json()) as Listing,
      };
    } catch {
      return { kind: 'unavailable' };
    }
  },
);

export const getPublicListings = cache(
  async (): Promise<Listing[] | null> => {
    try {
      const response = await fetch(`${publicApiBaseUrl()}/listings`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as Listing[];
    } catch {
      return null;
    }
  },
);
