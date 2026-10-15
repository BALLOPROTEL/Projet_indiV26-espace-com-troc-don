import { describe, expect, it } from 'vitest';
import { filterPendingListings, moderationMetrics } from './moderation-dashboard';
import type { Listing } from './types';
function item(id: string, title: string, operationType: Listing['operationType'], status: Listing['status'] = 'PENDING'): Listing {
  return { id, title, operationType, status, ownerId: 'owner', description: 'description',
    availabilityStatus: 'AVAILABLE', moderationReason: null, images: [], tradeWishes: [],
    createdAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
}
const items = [item('a', 'Étagère', 'DONATION'), item('b', 'Lampe', 'TRADE'), item('c', 'Livre', 'DONATION', 'APPROVED')];
describe('moderation dashboard uses only pending data from Catalog', () => {
  it('calculates real pending stats only', () => {
    expect(moderationMetrics(items)).toEqual({ total: 2, donations: 1, trades: 1 });
    expect(moderationMetrics([])).toEqual({ total: 0, donations: 0, trades: 0 });
  });
  it('filters DON/TROC while excluding approved listings', () => {
    expect(filterPendingListings(items, 'ALL', '').map((x) => x.id)).toEqual(['a', 'b']);
    expect(filterPendingListings(items, 'TRADE', '').map((x) => x.id)).toEqual(['b']);
    expect(filterPendingListings(items, 'DONATION', '').map((x) => x.id)).toEqual(['a']);
  });
  it('searches accent-insensitively', () => {
    expect(filterPendingListings(items, 'ALL', 'etagere').map((x) => x.id)).toEqual(['a']);
    expect(filterPendingListings(items, 'ALL', 'livre')).toEqual([]);
  });
});
