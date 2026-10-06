-- M3 - Marketplace Service owns proposals and transactions in schema "marketplace".
-- Listing identifiers remain scalar IDs on purpose: there is no cross-service FK to Catalog.

CREATE SCHEMA IF NOT EXISTS "marketplace";
SET search_path TO "marketplace";

CREATE TYPE "ProposalType" AS ENUM ('DONATION_REQUEST', 'TRADE_OFFER');
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "MarketplaceTransactionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

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

ALTER TABLE "MarketplaceTransaction"
  ADD CONSTRAINT "MarketplaceTransaction_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Transitional copy from the former monolith-owned public schema.
DO $$
BEGIN
  IF to_regclass('public."Proposal"') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO marketplace."Proposal" (
        "id", "targetListingId", "requesterId", "type",
        "offeredListingId", "message", "status", "resolvedAt",
        "createdAt", "updatedAt"
      )
      SELECT
        "id", "targetListingId", "requesterId",
        "type"::text::marketplace."ProposalType",
        "offeredListingId", "message",
        "status"::text::marketplace."ProposalStatus",
        "resolvedAt", "createdAt", "updatedAt"
      FROM public."Proposal"
      ON CONFLICT ("id") DO NOTHING
    $copy$;
  END IF;

  IF to_regclass('public."MarketplaceTransaction"') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO marketplace."MarketplaceTransaction" (
        "id", "proposalId", "targetListingId", "offeredListingId",
        "ownerId", "requesterId", "status", "ownerConfirmedAt",
        "requesterConfirmedAt", "completedAt", "cancelledAt",
        "createdAt", "updatedAt"
      )
      SELECT
        tx."id", tx."proposalId", tx."targetListingId", tx."offeredListingId",
        tx."ownerId", tx."requesterId",
        tx."status"::text::marketplace."MarketplaceTransactionStatus",
        tx."ownerConfirmedAt", tx."requesterConfirmedAt", tx."completedAt",
        tx."cancelledAt", tx."createdAt", tx."updatedAt"
      FROM public."MarketplaceTransaction" AS tx
      WHERE tx."proposalId" IN (
        SELECT "id" FROM marketplace."Proposal"
      )
      ON CONFLICT ("id") DO NOTHING
    $copy$;
  END IF;
END $$;
