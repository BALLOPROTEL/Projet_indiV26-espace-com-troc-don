-- LOT 9B-A - marketplace domain foundation:
-- listing availability, images, trade wishes, proposals and transactions.

CREATE TYPE "ListingAvailabilityStatus" AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'COMPLETED'
);

CREATE TYPE "ProposalType" AS ENUM (
    'DONATION_REQUEST',
    'TRADE_OFFER'
);

CREATE TYPE "ProposalStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED'
);

CREATE TYPE "MarketplaceTransactionStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

ALTER TABLE "Listing"
ADD COLUMN "availabilityStatus" "ListingAvailabilityStatus"
NOT NULL DEFAULT 'AVAILABLE';

CREATE TABLE "ListingImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "objectKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingTradeWish" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingTradeWish_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "targetListingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "ProposalType" NOT NULL,
    "offeredListingId" TEXT,
    "message" VARCHAR(1000),
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceTransaction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "targetListingId" TEXT NOT NULL,
    "offeredListingId" TEXT,
    "ownerId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "MarketplaceTransactionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "ownerConfirmedAt" TIMESTAMP(3),
    "requesterConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_status_availabilityStatus_createdAt_idx"
ON "Listing"("status", "availabilityStatus", "createdAt");

CREATE UNIQUE INDEX "ListingImage_objectKey_key"
ON "ListingImage"("objectKey");

CREATE UNIQUE INDEX "ListingImage_listingId_position_key"
ON "ListingImage"("listingId", "position");

CREATE INDEX "ListingImage_listingId_idx"
ON "ListingImage"("listingId");

CREATE UNIQUE INDEX "ListingTradeWish_listingId_position_key"
ON "ListingTradeWish"("listingId", "position");

CREATE INDEX "ListingTradeWish_listingId_idx"
ON "ListingTradeWish"("listingId");

CREATE INDEX "Proposal_targetListingId_status_createdAt_idx"
ON "Proposal"("targetListingId", "status", "createdAt");

CREATE INDEX "Proposal_requesterId_createdAt_idx"
ON "Proposal"("requesterId", "createdAt");

CREATE INDEX "Proposal_offeredListingId_status_idx"
ON "Proposal"("offeredListingId", "status");

CREATE UNIQUE INDEX "MarketplaceTransaction_proposalId_key"
ON "MarketplaceTransaction"("proposalId");

CREATE INDEX "MarketplaceTransaction_ownerId_status_createdAt_idx"
ON "MarketplaceTransaction"("ownerId", "status", "createdAt");

CREATE INDEX "MarketplaceTransaction_requesterId_status_createdAt_idx"
ON "MarketplaceTransaction"("requesterId", "status", "createdAt");

CREATE INDEX "MarketplaceTransaction_targetListingId_status_idx"
ON "MarketplaceTransaction"("targetListingId", "status");

CREATE INDEX "MarketplaceTransaction_offeredListingId_status_idx"
ON "MarketplaceTransaction"("offeredListingId", "status");

ALTER TABLE "ListingImage"
ADD CONSTRAINT "ListingImage_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingTradeWish"
ADD CONSTRAINT "ListingTradeWish_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_targetListingId_fkey"
FOREIGN KEY ("targetListingId") REFERENCES "Listing"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_offeredListingId_fkey"
FOREIGN KEY ("offeredListingId") REFERENCES "Listing"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceTransaction"
ADD CONSTRAINT "MarketplaceTransaction_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceTransaction"
ADD CONSTRAINT "MarketplaceTransaction_targetListingId_fkey"
FOREIGN KEY ("targetListingId") REFERENCES "Listing"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceTransaction"
ADD CONSTRAINT "MarketplaceTransaction_offeredListingId_fkey"
FOREIGN KEY ("offeredListingId") REFERENCES "Listing"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
