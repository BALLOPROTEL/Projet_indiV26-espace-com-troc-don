SET search_path TO "catalog";

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(4000) NOT NULL,
  "category" VARCHAR(120) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_priceCents_check" CHECK ("priceCents" > 0),
  CONSTRAINT "ProductVariant_stock_check" CHECK ("stock" >= 0)
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_createdAt_idx"
  ON "Product"("status", "createdAt");
CREATE INDEX "Product_status_category_createdAt_idx"
  ON "Product"("status", "category", "createdAt");

CREATE UNIQUE INDEX "ProductVariant_sku_key"
  ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_active_idx"
  ON "ProductVariant"("productId", "active");

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
