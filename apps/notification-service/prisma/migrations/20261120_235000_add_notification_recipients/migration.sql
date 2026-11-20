ALTER TABLE "notification"."notification_events"
  ADD COLUMN "recipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "notification_events_recipientIds_idx"
  ON "notification"."notification_events"
  USING GIN ("recipientIds");
