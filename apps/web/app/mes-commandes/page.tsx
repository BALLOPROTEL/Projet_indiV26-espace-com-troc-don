import type { Metadata } from 'next';
import { OrdersPage } from '../../components/orders-page';

export const metadata: Metadata = {
  title: 'Mes commandes',
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <OrdersPage />;
}
