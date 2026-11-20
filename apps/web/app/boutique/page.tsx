import type { Metadata } from 'next';
import { BoutiqueShowcase } from '../../components/prototype-showcase-pages';

export const metadata: Metadata = {
  title: 'Boutique',
  description: 'La boutique fantastique de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/boutique' },
};

export default function BoutiquePage() {
  return <BoutiqueShowcase />;
}
