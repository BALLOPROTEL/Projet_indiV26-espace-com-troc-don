import type { Metadata } from 'next';
import { FanzinesConnectedPage } from '../../components/connected-editorial-pages';

export const metadata: Metadata = {
  title: 'Fanzines',
  description: 'Le Fanzine de l’Épouvante.',
  alternates: { canonical: '/fanzines' },
};

export default function FanzinesPage() {
  return <FanzinesConnectedPage />;
}
