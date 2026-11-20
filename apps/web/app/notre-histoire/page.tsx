import type { Metadata } from 'next';
import { AboutPage } from '../../components/prototype-info-pages';

export const metadata: Metadata = {
  title: 'Notre histoire',
  description: 'Découvrez l’univers de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/notre-histoire' },
};

export default function Page() {
  return <AboutPage />;
}
