import type { Metadata } from 'next';
import { ProductCatalog } from '../../components/product-catalog';

export const metadata: Metadata = {
  title: 'Boutique',
  description: 'La boutique fantastique de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/boutique' },
};

export default function BoutiquePage() {
  return <ProductCatalog />;
}
