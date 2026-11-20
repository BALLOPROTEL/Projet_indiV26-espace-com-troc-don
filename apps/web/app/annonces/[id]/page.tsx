import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import './product-v2.css';
import { ListingDetail } from '../../../components/listing-detail';
import {
  getPublicListing,
  publicListingAssetUrl,
} from '../../../lib/server-listings';

type PageProps = {
  params: Promise<{ id: string }>;
};

function seoDescription(description: string): string {
  const compact = description.replace(/\s+/g, ' ').trim();
  return compact.length <= 155
    ? compact
    : `${compact.slice(0, 152).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const lookup = await getPublicListing(id);

  if (lookup.kind === 'not-found') {
    return {
      title: 'Annonce introuvable',
      description: 'Cette annonce n’existe pas ou n’est plus publiée.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (lookup.kind === 'unavailable') {
    return {
      title: 'Fiche annonce',
      description: 'Consultez cette annonce de don ou de troc.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { listing } = lookup;
  const description = seoDescription(listing.description);
  const canonical = `/annonces/${encodeURIComponent(listing.id)}`;
  const socialImage = listing.images[0]?.contentUrl
    ? publicListingAssetUrl(listing.images[0].contentUrl)
    : undefined;

  return {
    title: listing.title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      title: listing.title,
      description,
      images: socialImage
        ? [{ url: socialImage, alt: listing.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function ListingDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const lookup = await getPublicListing(id);

  if (lookup.kind === 'not-found') {
    notFound();
  }

  return (
    <ListingDetail
      key={id}
      id={id}
      initialListing={lookup.kind === 'found' ? lookup.listing : undefined}
    />
  );
}
