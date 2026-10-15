import type { Listing, ListingOperationType } from './types';

export const HOME_PAGE_SIZE = 6;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
}

export function filterPublicListings(
  listings: readonly Listing[],
  search: string,
  type: ListingOperationType | 'ALL',
): Listing[] {
  const query = normalize(search);
  return listings.filter((listing) => (
    listing.status === 'APPROVED' &&
    (type === 'ALL' || listing.operationType === type) &&
    (!query || normalize([
      listing.title,
      listing.description,
      ...listing.tradeWishes.map((wish) => wish.label),
    ].join(' ')).includes(query))
  ));
}

export function paginateListings<T>(
  listings: readonly T[],
  requestedPage: number,
  pageSize = HOME_PAGE_SIZE,
) {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(listings.length / size));
  const safeRequested = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.max(1, Math.min(pages, safeRequested));
  const offset = (page - 1) * size;
  const items = listings.slice(offset, offset + size);
  return {
    items,
    page,
    pages,
    total: listings.length,
    start: items.length ? offset + 1 : 0,
    end: offset + items.length,
  };
}

export function paginationNumbers(currentPage: number, totalPages: number): number[] {
  const numbers = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...numbers].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}
