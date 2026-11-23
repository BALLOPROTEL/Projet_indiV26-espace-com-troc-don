SET search_path TO "commerce";

ALTER TYPE "OrderStatus"
  ADD VALUE IF NOT EXISTS 'PAID';

ALTER TABLE "Order"
  ADD COLUMN "paymentSessionId" TEXT,
  ADD COLUMN "paymentIntentId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_paymentSessionId_key"
  ON "Order"("paymentSessionId");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" VARCHAR(255) NOT NULL,
  "type" VARCHAR(120) NOT NULL,
  "orderId" VARCHAR(128),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key"
  ON "PaymentWebhookEvent"("providerEventId");

CREATE INDEX "PaymentWebhookEvent_orderId_processedAt_idx"
  ON "PaymentWebhookEvent"("orderId", "processedAt");
