-- Notification has its own schema, separate from legacy, Catalog and Marketplace.
-- eventId remains unique indefinitely: an old RabbitMQ delivery is never
-- processed again just because it fell outside the latest-50 UI read window.
CREATE SCHEMA IF NOT EXISTS "notification";
CREATE TABLE "notification"."notification_events" (
    "eventId" VARCHAR(128) NOT NULL,
    "event" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("eventId")
);
CREATE INDEX "notification_events_receivedAt_idx"
  ON "notification"."notification_events"("receivedAt");
