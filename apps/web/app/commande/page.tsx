import type { Metadata } from 'next';
import { CheckoutPlaceholderPage } from '../../components/prototype-commerce-placeholders';
export const metadata: Metadata = { title: 'Finaliser ma commande', robots: { index: false, follow: false } };
export default function Page(){ return <CheckoutPlaceholderPage />; }
