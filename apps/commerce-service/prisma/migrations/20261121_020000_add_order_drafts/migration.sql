SET search_path TO "commerce";

CREATE TYPE "OrderStatus" AS ENUM ('DRAFT');

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "subtotalCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "recipientFirstName" TEXT NOT NULL,
  "recipientLastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_subtotalCents_check" CHECK ("subtotalCents" >= 0)
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variantLabel" TEXT NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineTotalCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_unitPriceCents_check" CHECK ("unitPriceCents" > 0),
  CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 99),
  CONSTRAINT "OrderItem_lineTotalCents_check" CHECK ("lineTotalCents" > 0)
);

CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key"
  ON "Order"("userId", "idempotencyKey");
CREATE INDEX "Order_userId_createdAt_idx"
  ON "Order"("userId", "createdAt");
CREATE INDEX "OrderItem_orderId_createdAt_idx"
  ON "OrderItem"("orderId", "createdAt");

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
