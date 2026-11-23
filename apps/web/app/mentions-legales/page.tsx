import type { Metadata } from 'next';
import { LegalNoticePage } from '../../components/legal-pages';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales et informations sur l’éditeur.',
  alternates: { canonical: '/mentions-legales' },
};

export default function Page() {
  return <LegalNoticePage />;
}
