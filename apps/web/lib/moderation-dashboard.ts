import type { Listing, ListingOperationType } from './types';

export type ModerationFilter = ListingOperationType | 'ALL';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
}
export function moderationMetrics(listings: readonly Listing[]) {
  const pending = listings.filter((item) => item.status === 'PENDING');
  return {
    total: pending.length,
    donations: pending.filter((item) => item.operationType === 'DONATION').length,
    trades: pending.filter((item) => item.operationType === 'TRADE').length,
  };
}
export function filterPendingListings(listings: readonly Listing[], filter: ModerationFilter, search: string): Listing[] {
  const query = normalize(search);
  return listings.filter((item) =>
    item.status === 'PENDING' &&
    (filter === 'ALL' || item.operationType === filter) &&
    (!query || normalize([
      item.title, item.description,
      ...item.tradeWishes.map((wish) => wish.label),
    ].join(' ')).includes(query)),
  );
}
