CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS');
CREATE TYPE "ListingReportReason" AS ENUM ('PROHIBITED', 'SCAM', 'MISLEADING', 'HARASSMENT', 'DUPLICATE', 'OTHER');
CREATE TYPE "ListingReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

ALTER TABLE "Listing"
  ADD COLUMN "category" VARCHAR(80),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "condition" "ListingCondition";

CREATE TABLE "ListingReport" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "ListingReportReason" NOT NULL,
  "details" VARCHAR(1000),
  "status" "ListingReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_status_category_createdAt_idx" ON "Listing"("status", "category", "createdAt");
CREATE INDEX "Listing_status_city_createdAt_idx" ON "Listing"("status", "city", "createdAt");
CREATE UNIQUE INDEX "ListingReport_listingId_reporterId_key" ON "ListingReport"("listingId", "reporterId");
CREATE INDEX "ListingReport_status_createdAt_idx" ON "ListingReport"("status", "createdAt");
CREATE INDEX "ListingReport_listingId_createdAt_idx" ON "ListingReport"("listingId", "createdAt");
CREATE INDEX "ListingReport_reporterId_createdAt_idx" ON "ListingReport"("reporterId", "createdAt");

ALTER TABLE "ListingReport"
  ADD CONSTRAINT "ListingReport_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
