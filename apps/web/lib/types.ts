export type ListingOperationType = 'TRADE' | 'DONATION';
export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ListingAvailabilityStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'COMPLETED';

export type ListingImage = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  contentUrl: string;
};

export type ListingTradeWish = {
  id: string;
  label: string;
  position: number;
};

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  operationType: ListingOperationType;
  status: ListingStatus;
  availabilityStatus: ListingAvailabilityStatus;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
  tradeWishes: ListingTradeWish[];
};

export type ListingInput = {
  title: string;
  description: string;
  operationType: ListingOperationType;
  tradeWishes: string[];
};
