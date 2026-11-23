import type { Metadata } from 'next';
import { CheckoutPage } from '../../components/checkout-page';

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CheckoutPage />;
}
