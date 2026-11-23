SET search_path TO "catalog";

CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "objectKey" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImage_objectKey_key"
  ON "ProductImage"("objectKey");
CREATE UNIQUE INDEX "ProductImage_productId_position_key"
  ON "ProductImage"("productId", "position");
CREATE INDEX "ProductImage_productId_idx"
  ON "ProductImage"("productId");

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
