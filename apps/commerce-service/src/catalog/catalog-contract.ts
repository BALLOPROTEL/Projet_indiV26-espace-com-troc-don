export type ProductStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type CatalogProductVariantSnapshot = {
  productId: string;
  slug: string;
  name: string;
  currency: string;
  status: ProductStatus;
  variantId: string;
  variantLabel: string;
  priceCents: number;
  stock: number;
  active: boolean;
  primaryImageId: string | null;
};


export type CatalogStockReservationStatus =
  | 'ACTIVE'
  | 'RELEASED'
  | 'EXPIRED'
  | 'COMMITTED';

export type CatalogStockReservation = {
  id: string;
  orderId: string;
  status: CatalogStockReservationStatus;
  expiresAt: string;
  items: Array<{
    id: string;
    reservationId: string;
    productId: string;
    variantId: string;
    quantity: number;
    createdAt: string;
  }>;
};
