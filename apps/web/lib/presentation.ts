import type {
  ListingOperationType,
  ListingStatus,
} from './types';

export function operationLabel(
  operationType: ListingOperationType,
): string {
  return operationType === 'DONATION' ? 'Don' : 'Troc';
}

export function statusLabel(status: ListingStatus): string {
  const labels: Record<ListingStatus, string> = {
    PENDING: 'À relire',
    APPROVED: 'Publié',
    REJECTED: 'À corriger',
  };

  return labels[status];
}

export function formatListingDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function canEditListing(status: ListingStatus): boolean {
  return status !== 'APPROVED';
}
