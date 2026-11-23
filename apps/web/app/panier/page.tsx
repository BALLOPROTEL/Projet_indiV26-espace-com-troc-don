import type { Metadata } from 'next';
import { CartPage } from '../../components/cart-page';

export const metadata: Metadata = {
  title: 'Mon panier',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CartPage />;
}
