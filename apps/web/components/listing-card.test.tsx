import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListingCard } from './listing-card';
import type { Listing } from '../lib/types';

const listing: Listing = {
  id: 'article-1',
  ownerId: 'owner',
  title: 'Une table pour le salon',
  description: 'À récupérer sur rendez-vous',
  operationType: 'DONATION',
  status: 'APPROVED',
  availabilityStatus: 'AVAILABLE',
  moderationReason: null,
  createdAt: '2026-10-15T10:00:00Z',
  updatedAt: '2026-10-15T10:00:00Z',
  images: [],
  tradeWishes: [],
};

describe('listing card: break-ui no-photo states', () => {
  it('shows an accessible neutral empty cover without inventing a picture', () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={listing} href="/annonces/article-1" showAvailability />,
    );
    expect(html).toContain('listing-card__cover--empty');
    expect(html).toContain('Aucune photo disponible');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="/annonces/article-1"');
    expect(html).toContain('Voir la fiche');
    expect(html).toContain('Disponible');
  });

  it('does not leak an unapproved private image as a public cover', () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={{
        ...listing,
        status: 'PENDING',
        images: [{
          id: 'private-1', position: 0, mimeType: 'image/png',
          sizeBytes: 4000, contentUrl: '/api/listings/private-picture',
        }],
      }} showStatus />,
    );
    expect(html).toContain('Aperçu non disponible');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('private-picture');
  });

  it('keeps a real approved cover and its count without showing the placeholder', () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={{
        ...listing,
        images: [{
          id: 'photo-1', position: 0, mimeType: 'image/png',
          sizeBytes: 4000, contentUrl: '/api/listings/actual-picture',
        }],
      }} href="/annonces/article-1" />,
    );
    expect(html).toContain('<img');
    expect(html).toContain('1 photos');
    expect(html).not.toContain('Aucune photo disponible');
    expect(html).not.toContain('listing-card__cover--empty');
  });

  it('retains a very long unbroken title in the actual detail link', () => {
    const longTitle = 'Réutilisable'.repeat(30);
    const html = renderToStaticMarkup(
      <ListingCard listing={{ ...listing, title: longTitle }} href="/annonces/article-1" />,
    );
    expect(html).toContain(longTitle);
    expect(html).toContain('Aucune photo disponible');
    expect(html).toContain('href="/annonces/article-1"');
  });
});
