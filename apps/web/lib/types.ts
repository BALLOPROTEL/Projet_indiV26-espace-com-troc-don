export type ListingOperationType = 'TRADE' | 'DONATION';
export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  operationType: ListingOperationType;
  status: ListingStatus;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingInput = {
  title: string;
  description: string;
  operationType: ListingOperationType;
};
