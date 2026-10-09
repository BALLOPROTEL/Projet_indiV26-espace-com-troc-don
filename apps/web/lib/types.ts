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


export type ProposalType = 'DONATION_REQUEST' | 'TRADE_OFFER';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type MarketplaceProposal = {
  id: string;
  targetListingId: string;
  requesterId: string;
  type: ProposalType;
  offeredListingId: string | null;
  message: string | null;
  status: ProposalStatus;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceTransaction = {
  id: string;
  proposalId: string;
  targetListingId: string;
  offeredListingId: string | null;
  ownerId: string;
  requesterId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  ownerConfirmedAt: string | null;
  requesterConfirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};
