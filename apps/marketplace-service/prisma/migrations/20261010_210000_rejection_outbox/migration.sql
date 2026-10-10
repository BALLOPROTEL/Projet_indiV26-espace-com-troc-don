-- Outbox in Marketplace-owned database; same transaction as Proposal status.
-- Messages remain pending until RabbitMQ confirms publication. Retries retain
-- the same eventId, allowing Notification's durable inbox to deduplicate.
SET search_path TO "marketplace";

CREATE TABLE "MarketplaceOutboxEvent" (
  "eventId" VARCHAR(128) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MarketplaceOutboxEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "MarketplaceOutboxEvent_publishedAt_createdAt_idx"
  ON "MarketplaceOutboxEvent"("publishedAt", "createdAt");
