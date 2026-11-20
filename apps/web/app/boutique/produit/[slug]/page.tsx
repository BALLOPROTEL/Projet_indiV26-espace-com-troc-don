import type { Metadata } from 'next';
import { ProductDetail } from '../../../../components/product-catalog';

export const metadata: Metadata = {
  title: 'Fiche produit',
  robots: { index: false, follow: false },
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ProductDetail slug={slug} />;
}
