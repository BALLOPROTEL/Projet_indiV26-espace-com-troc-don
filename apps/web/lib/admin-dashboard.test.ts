import { describe, expect, it } from 'vitest';
import { adminCatalogBars, canAccessAdmin, formatAdminCount, parseAdminCatalogSummary } from './admin-dashboard';
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

describe('ADMIN summary API runtime contract and worst-case counts', () => {
  const summary: AdminCatalogSummary = {
    total: 1000,
    byStatus: { pending: 1, approved: 999, rejected: 0 },
    byOperation: { donations: 650, trades: 350 },
    approvedAvailability: { available: 900, reserved: 80, completed: 19 },
  };

  it('accepts real non-negative aggregate counters', () => {
    expect(parseAdminCatalogSummary(summary)).toEqual(summary);
    expect(parseAdminCatalogSummary({
      total: 0,
      byStatus: { pending: 0, approved: 0, rejected: 0 },
      byOperation: { donations: 0, trades: 0 },
      approvedAvailability: { available: 0, reserved: 0, completed: 0 },
    })).toHaveProperty('total', 0);
  });

  it.each([
    null,
    {},
    { ...summary, total: -1 },
    { ...summary, total: 1.5 },
    { ...summary, total: Number.NaN },
    { ...summary, byStatus: { ...summary.byStatus, pending: '1' } },
    { ...summary, byOperation: null },
    { ...summary, approvedAvailability: { ...summary.approvedAvailability, available: null } },
  ])('rejects malformed API payloads rather than fake or broken metrics', (payload) => {
    expect(() => parseAdminCatalogSummary(payload)).toThrow(
      'Réponse des statistiques administrateur invalide.',
    );
  });

  it('uses French separators when counts reach thousands', () => {
    expect(formatAdminCount(1000)).toMatch(/^1[\u00a0\u202f ]000$/);
    expect(formatAdminCount(0)).toBe('0');
  });
});
