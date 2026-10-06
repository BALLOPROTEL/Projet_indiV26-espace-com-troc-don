-- M2 - Catalog Service owns listing data in PostgreSQL schema "catalog".
-- The copy block preserves existing listing data during the Strangler migration.

CREATE SCHEMA IF NOT EXISTS "catalog";
SET search_path TO "catalog";

CREATE TYPE "ListingOperationType" AS ENUM ('TRADE', 'DONATION');
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ListingAvailabilityStatus" AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'COMPLETED'
);

CREATE TABLE "Listing" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "operationType" "ListingOperationType" NOT NULL,
  "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
  "availabilityStatus" "ListingAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  "moderationReason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

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

CREATE INDEX "Listing_ownerId_createdAt_idx"
  ON "Listing"("ownerId", "createdAt");
CREATE INDEX "Listing_status_createdAt_idx"
  ON "Listing"("status", "createdAt");
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

ALTER TABLE "ListingImage"
  ADD CONSTRAINT "ListingImage_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingTradeWish"
  ADD CONSTRAINT "ListingTradeWish_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Transitional data copy from the former monolith-owned public schema.
-- A fresh installation without the legacy tables simply skips this block.
DO $$
BEGIN
  IF to_regclass('public."Listing"') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO catalog."Listing" (
        "id", "ownerId", "title", "description", "operationType",
        "status", "availabilityStatus", "moderationReason",
        "createdAt", "updatedAt"
      )
      SELECT
        "id", "ownerId", "title", "description",
        "operationType"::text::catalog."ListingOperationType",
        "status"::text::catalog."ListingStatus",
        "availabilityStatus"::text::catalog."ListingAvailabilityStatus",
        "moderationReason", "createdAt", "updatedAt"
      FROM public."Listing"
      ON CONFLICT ("id") DO NOTHING
    $copy$;
  END IF;

  IF to_regclass('public."ListingImage"') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO catalog."ListingImage" (
        "id", "listingId", "objectKey", "mimeType",
        "sizeBytes", "position", "createdAt"
      )
      SELECT
        "id", "listingId", "objectKey", "mimeType",
        "sizeBytes", "position", "createdAt"
      FROM public."ListingImage"
      WHERE "listingId" IN (SELECT "id" FROM catalog."Listing")
      ON CONFLICT ("id") DO NOTHING
    $copy$;
  END IF;

  IF to_regclass('public."ListingTradeWish"') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO catalog."ListingTradeWish" (
        "id", "listingId", "label", "position", "createdAt"
      )
      SELECT "id", "listingId", "label", "position", "createdAt"
      FROM public."ListingTradeWish"
      WHERE "listingId" IN (SELECT "id" FROM catalog."Listing")
      ON CONFLICT ("id") DO NOTHING
    $copy$;
  END IF;
END $$;
