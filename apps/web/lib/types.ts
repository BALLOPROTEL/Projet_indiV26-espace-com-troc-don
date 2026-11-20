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

/** No account identities or raw listing content are returned by Catalog. */
export type AdminCatalogSummary = {
  total: number;
  byStatus: {
    pending: number;
    approved: number;
    rejected: number;
  };
  byOperation: {
    donations: number;
    trades: number;
  };
  approvedAvailability: {
    available: number;
    reserved: number;
    completed: number;
  };
};


export type NotificationEvent =
  | {
      eventId: string;
      type: 'proposal.created';
      version: 1;
      occurredAt: string;
      source: 'marketplace-service';
      data: {
        proposalId: string;
        targetListingId: string;
        requesterId: string;
        ownerId: string | null;
        proposalType: ProposalType;
        offeredListingId: string | null;
      };
    }
  | {
      eventId: string;
      type: 'proposal.accepted';
      version: 1;
      occurredAt: string;
      source: 'marketplace-service';
      data: {
        proposalId: string;
        transactionId: string;
        targetListingId: string;
        offeredListingId: string | null;
        ownerId: string;
        requesterId: string;
      };
    }
  | {
      eventId: string;
      type: 'proposal.rejected';
      version: 1;
      occurredAt: string;
      source: 'marketplace-service';
      data: {
        proposalId: string;
        targetListingId: string;
        requesterId: string;
        ownerId: string;
      };
    }
  | {
      eventId: string;
      type: 'transaction.completed';
      version: 1;
      occurredAt: string;
      source: 'marketplace-service';
      data: {
        transactionId: string;
        proposalId: string;
        targetListingId: string;
        offeredListingId: string | null;
        ownerId: string;
        requesterId: string;
      };
    };

export type UserNotification = {
  receivedAt: string;
  event: NotificationEvent;
};


export type ProductImage = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  contentUrl: string;
};

export type ProductVariant = {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  stock: number;
  active: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  fromPriceCents: number;
  availableStock: number;
  variants: ProductVariant[];
  images: ProductImage[];
};


export type AdminProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type AdminProductImage = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  status: AdminProductStatus;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
  images: AdminProductImage[];
};

export type AdminProductCreateInput = {
  slug: string;
  name: string;
  description: string;
  category: string;
  currency?: 'EUR';
  variants: Array<{
    sku: string;
    label: string;
    priceCents: number;
    stock: number;
    active?: boolean;
  }>;
};


export type CartUnavailableReason =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_PUBLISHED'
  | 'VARIANT_INACTIVE'
  | 'INSUFFICIENT_STOCK';

export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  productName: string | null;
  productSlug: string | null;
  variantLabel: string | null;
  currency: 'EUR' | null;
  unitPriceCents: number | null;
  stock: number | null;
  available: boolean;
  unavailableReason: CartUnavailableReason | null;
  lineTotalCents: number | null;
  imageUrl: string | null;
};

export type Cart = {
  items: CartItem[];
  currency: 'EUR';
  subtotalCents: number;
  hasUnavailableItems: boolean;
};
