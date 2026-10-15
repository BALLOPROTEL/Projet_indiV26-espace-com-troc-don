import type { AdminCatalogSummary } from './types';

export function canAccessAdmin(
  authenticated: boolean,
  roles: readonly ('USER' | 'MODERATOR' | 'ADMIN')[],
): boolean {
  return authenticated && roles.includes('ADMIN');
}

export function adminCatalogBars(summary: AdminCatalogSummary) {
  const all = Math.max(1, summary.total);
  return [
    {
      key: 'donations',
      label: 'Dons',
      count: summary.byOperation.donations,
      percentage: Math.min(100, Math.max(0,
        (summary.byOperation.donations / all) * 100)),
    },
    {
      key: 'trades',
      label: 'Trocs',
      count: summary.byOperation.trades,
      percentage: Math.min(100, Math.max(0,
        (summary.byOperation.trades / all) * 100)),
    },
  ];
}
