export const ListingOperationType = {
  TRADE: 'TRADE',
  DONATION: 'DONATION',
} as const;

export const ListingStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const ListingAvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  COMPLETED: 'COMPLETED',
} as const;

export type CatalogListingSnapshot = {
  id: string;
  ownerId: string;
  operationType:
    (typeof ListingOperationType)[keyof typeof ListingOperationType];
  status: (typeof ListingStatus)[keyof typeof ListingStatus];
  availabilityStatus:
    (typeof ListingAvailabilityStatus)[keyof typeof ListingAvailabilityStatus];
};
