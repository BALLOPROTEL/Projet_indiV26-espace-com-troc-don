CREATE SCHEMA IF NOT EXISTS "commerce";
SET search_path TO "commerce";

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 99)
);

CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key"
  ON "CartItem"("cartId", "variantId");
CREATE INDEX "CartItem_cartId_createdAt_idx"
  ON "CartItem"("cartId", "createdAt");

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
