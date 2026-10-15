import { describe, expect, it } from 'vitest';
import { adminCatalogBars, canAccessAdmin } from './admin-dashboard';
import type { AdminCatalogSummary } from './types';

describe('ADMIN dashboard access', () => {
  it('never grants UI access to guests, USER or MODERATOR', () => {
    expect(canAccessAdmin(false, ['ADMIN'])).toBe(false);
    expect(canAccessAdmin(true, ['USER'])).toBe(false);
    expect(canAccessAdmin(true, ['MODERATOR'])).toBe(false);
    expect(canAccessAdmin(true, [])).toBe(false);
  });
  it('grants UI access only to authenticated ADMIN', () => {
    expect(canAccessAdmin(true, ['ADMIN'])).toBe(true);
    expect(canAccessAdmin(true, ['USER', 'ADMIN'])).toBe(true);
  });
});

describe('ADMIN dashboard uses real Catalog counts', () => {
  const summary: AdminCatalogSummary = {
    total: 10,
    byStatus: { pending: 2, approved: 7, rejected: 1 },
    byOperation: { donations: 3, trades: 7 },
    approvedAvailability: { available: 4, reserved: 2, completed: 1 },
  };
  it('computes DON/TROC bars without fake data', () => {
    expect(adminCatalogBars(summary)).toEqual([
      { key: 'donations', label: 'Dons', count: 3, percentage: 30 },
      { key: 'trades', label: 'Trocs', count: 7, percentage: 70 },
    ]);
  });
  it('handles an empty catalogue without division by zero', () => {
    expect(adminCatalogBars({
      ...summary, total: 0,
      byOperation: { donations: 0, trades: 0 },
    }).map((bar) => bar.percentage)).toEqual([0, 0]);
  });
});
