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

/** Fail closed on malformed or impossible API counters instead of rendering NaN. */
export function parseAdminCatalogSummary(input: unknown): AdminCatalogSummary {
  if (!input || typeof input !== 'object') {
    throw new Error('Réponse des statistiques administrateur invalide.');
  }

  const summary = input as Partial<AdminCatalogSummary>;
  const values: unknown[] = [
    summary.total,
    summary.byStatus?.pending,
    summary.byStatus?.approved,
    summary.byStatus?.rejected,
    summary.byOperation?.donations,
    summary.byOperation?.trades,
    summary.approvedAvailability?.available,
    summary.approvedAvailability?.reserved,
    summary.approvedAvailability?.completed,
  ];

  if (values.some((value) =>
    typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0
  )) {
    throw new Error('Réponse des statistiques administrateur invalide.');
  }

  const [
    total, pending, approved, rejected,
    donations, trades, available, reserved, completed,
  ] = values as [number, number, number, number, number, number, number, number, number];

  // The Catalog contract must agree across all three independent groupings.
  if (
    pending + approved + rejected !== total ||
    donations + trades !== total ||
    available + reserved + completed !== approved
  ) {
    throw new Error('Réponse des statistiques administrateur incohérente.');
  }

  return summary as AdminCatalogSummary;
}

export function formatAdminCount(value: number): string {
  return value.toLocaleString('fr-FR');
}
