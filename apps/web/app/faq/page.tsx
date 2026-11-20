import type { Metadata } from 'next';
import { FaqPage } from '../../components/prototype-info-pages';

export const metadata: Metadata = {
  title: 'Aide & FAQ',
  description: 'Les principales questions sur La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/faq' },
};

export default function Page() {
  return <FaqPage />;
}
