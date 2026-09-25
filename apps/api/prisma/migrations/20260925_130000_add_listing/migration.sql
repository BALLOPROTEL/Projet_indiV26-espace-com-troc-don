-- LOT 3 - community trade/donation listings and moderation

CREATE TYPE "ListingOperationType" AS ENUM ('TRADE', 'DONATION');
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "operationType" "ListingOperationType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "moderationReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_ownerId_createdAt_idx"
ON "Listing"("ownerId", "createdAt");

CREATE INDEX "Listing_status_createdAt_idx"
ON "Listing"("status", "createdAt");
