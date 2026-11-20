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
