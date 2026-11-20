import type { Metadata } from 'next';
import { FanzinesShowcase } from '../../components/prototype-showcase-pages';

export const metadata: Metadata = {
  title: 'Fanzines',
  description: 'Le Fanzine de l’Épouvante.',
  alternates: { canonical: '/fanzines' },
};

export default function FanzinesPage() {
  return <FanzinesShowcase />;
}
