CREATE TYPE "PrivacyExecutionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

CREATE TABLE "PrivacyExecution" (
  "id" TEXT NOT NULL,
  "contactMessageId" TEXT NOT NULL,
  "originalUserId" TEXT,
  "catalogReplacementId" TEXT NOT NULL,
  "marketplaceReplacementId" TEXT NOT NULL,
  "commerceReplacementId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "status" "PrivacyExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "lastError" VARCHAR(1000),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyExecution_contactMessageId_key"
  ON "PrivacyExecution"("contactMessageId");
CREATE INDEX "PrivacyExecution_status_createdAt_idx"
  ON "PrivacyExecution"("status", "createdAt");
CREATE INDEX "PrivacyExecution_reviewerId_createdAt_idx"
  ON "PrivacyExecution"("reviewerId", "createdAt");
