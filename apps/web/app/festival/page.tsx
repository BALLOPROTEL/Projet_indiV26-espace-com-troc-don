import type { Metadata } from 'next';
import { FestivalConnectedPage } from '../../components/connected-editorial-pages';

export const metadata: Metadata = {
  title: 'Festival',
  description: 'Festival et actualités de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/festival' },
};

export default function FestivalPage() {
  return <FestivalConnectedPage />;
}
