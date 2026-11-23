import type { Metadata } from 'next';
import { TermsPage } from '../../components/legal-pages';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Conditions d’utilisation de La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/conditions' },
};

export default function Page() {
  return <TermsPage />;
}
