import type { Metadata } from 'next';
import { FestivalShowcase } from '../../components/prototype-showcase-pages';

export const metadata: Metadata = {
  title: 'Festival',
  description: 'Festival et actualités de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/festival' },
};

export default function FestivalPage() {
  return <FestivalShowcase />;
}
