import type { Metadata } from 'next';
import { PrivacyPolicyPage } from '../../components/legal-pages';

export const metadata: Metadata = {
  title: 'Confidentialité',
  description: 'Politique de confidentialité et droits sur les données.',
  alternates: { canonical: '/confidentialite' },
};

export default function Page() {
  return <PrivacyPolicyPage />;
}
