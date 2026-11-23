SET search_path TO "catalog";

CREATE TABLE "ListingFavorite" (
  "userId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingFavorite_pkey" PRIMARY KEY ("userId", "listingId")
);

CREATE INDEX "ListingFavorite_userId_createdAt_idx"
  ON "ListingFavorite"("userId", "createdAt");

ALTER TABLE "ListingFavorite"
  ADD CONSTRAINT "ListingFavorite_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
