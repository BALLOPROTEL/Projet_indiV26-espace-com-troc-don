import { describe, expect, it } from 'vitest';
import type { Listing } from './types';
import {
  HOME_PAGE_SIZE,
  filterPublicListings,
  paginateListings,
  paginationNumbers,
} from './home-pagination';

function makeListing(index: number, options: Partial<Listing> = {}): Listing {
  return {
    id: String(index),
    ownerId: 'user',
    title: `Lampe numéro ${index}`,
    description: 'Objet pour une nouvelle maison',
    operationType: index % 2 === 0 ? 'DONATION' : 'TRADE',
    status: 'APPROVED',
    availabilityStatus: 'AVAILABLE',
    moderationReason: null,
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
    images: [],
    tradeWishes: [],
    ...options,
  };
}

describe('home listing pagination', () => {
  it('has a fixed public limit of six cards per page', () => {
    expect(HOME_PAGE_SIZE).toBe(6);
    for (const n of [0, 1, 6, 7, 12, 13]) {
      const items = Array.from({ length: n }, (_, i) => i);
      const first = paginateListings(items, 1);
      expect(first.items.length).toBe(Math.min(6, n));
      expect(first.total).toBe(n);
      expect(first.pages).toBe(Math.max(1, Math.ceil(n / 6)));
    }
  });

  it('places item seven on page two and thirteen on page three', () => {
    const seven = paginateListings(Array.from({ length: 7 }, (_, i) => i), 2);
    expect(seven.items).toEqual([6]);
    expect([seven.start, seven.end, seven.pages]).toEqual([7, 7, 2]);
    const thirteen = paginateListings(Array.from({ length: 13 }, (_, i) => i), 3);
    expect(thirteen.items).toEqual([12]);
    expect([thirteen.start, thirteen.end, thirteen.pages]).toEqual([13, 13, 3]);
  });

  it('clamps invalid and out-of-range pages, including empty lists', () => {
    expect(paginateListings([], 12)).toMatchObject({ page: 1, pages: 1, items: [], start: 0, end: 0 });
    expect(paginateListings([1, 2, 3], -5).page).toBe(1);
    expect(paginateListings([1, 2, 3], Number.NaN).page).toBe(1);
    expect(paginateListings([1, 2, 3], 999).page).toBe(1);
    expect(paginateListings(Array.from({ length: 12 }, (_, i) => i), 999).page).toBe(2);
  });

  it('uses an accessible small page window including the first and last', () => {
    expect(paginationNumbers(2, 3)).toEqual([1, 2, 3]);
    expect(paginationNumbers(8, 20)).toEqual([1, 7, 8, 9, 20]);
  });
});

describe('home public search and operation filters', () => {
  const listings: Listing[] = [
    makeListing(1, { title: 'Étagère ancienne', operationType: 'DONATION' }),
    makeListing(2, { title: 'Lampe verte', operationType: 'TRADE', tradeWishes: [
      { id: 'a', label: 'Un livre', position: 0 },
    ] }),
    makeListing(3, { title: 'Non publique', status: 'PENDING' }),
  ];
  it('matches French diacritics without exposing pending listings', () => {
    expect(filterPublicListings(listings, 'etagere', 'ALL').map((x) => x.id)).toEqual(['1']);
    expect(filterPublicListings(listings, '', 'ALL').map((x) => x.id)).toEqual(['1', '2']);
  });
  it('filters by type and searches the actual trade wishes', () => {
    expect(filterPublicListings(listings, 'livre', 'TRADE').map((x) => x.id)).toEqual(['2']);
    expect(filterPublicListings(listings, '', 'DONATION').map((x) => x.id)).toEqual(['1']);
    expect(filterPublicListings(listings, 'inconnu', 'ALL')).toEqual([]);
  });
});
