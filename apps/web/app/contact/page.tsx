import type { Metadata } from 'next';
import { ContactPage } from '../../components/prototype-info-pages';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contacter La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/contact' },
};

export default function Page() {
  return <ContactPage />;
}
