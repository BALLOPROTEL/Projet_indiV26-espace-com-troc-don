import type { Metadata } from 'next';
import { OrdersPlaceholderPage } from '../../components/prototype-account-placeholders';
export const metadata: Metadata = { title: 'Mes commandes', robots: { index: false, follow: false, nocache: true } };
export default function Page(){ return <OrdersPlaceholderPage />; }
