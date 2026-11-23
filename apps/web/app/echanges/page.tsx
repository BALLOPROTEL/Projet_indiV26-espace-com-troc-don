import type { Metadata } from 'next';
import { ExchangeSpace } from '../../components/exchange-space';

export const metadata: Metadata = {
  title: 'Échanges & dons',
  description: 'Découvrez les annonces de don et de troc de la communauté.',
  alternates: {
    canonical: '/echanges',
  },
};

export default function ExchangesPage() {
  return <ExchangeSpace />;
}
