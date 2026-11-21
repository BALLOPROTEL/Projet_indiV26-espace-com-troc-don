SET search_path TO "catalog";

CREATE TYPE "ProductStockReservationStatus"
  AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'COMMITTED');

CREATE TABLE "ProductStockReservation" (
  "id" TEXT NOT NULL,
  "orderId" VARCHAR(128) NOT NULL,
  "status" "ProductStockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductStockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductStockReservationItem" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductStockReservationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductStockReservationItem_quantity_check"
    CHECK ("quantity" > 0 AND "quantity" <= 99)
);

CREATE UNIQUE INDEX "ProductStockReservation_orderId_key"
  ON "ProductStockReservation"("orderId");
CREATE INDEX "ProductStockReservation_status_expiresAt_idx"
  ON "ProductStockReservation"("status", "expiresAt");
CREATE UNIQUE INDEX "ProductStockReservationItem_reservationId_variantId_key"
  ON "ProductStockReservationItem"("reservationId", "variantId");
CREATE INDEX "ProductStockReservationItem_reservationId_createdAt_idx"
  ON "ProductStockReservationItem"("reservationId", "createdAt");

ALTER TABLE "ProductStockReservationItem"
  ADD CONSTRAINT "ProductStockReservationItem_reservationId_fkey"
  FOREIGN KEY ("reservationId")
  REFERENCES "ProductStockReservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
