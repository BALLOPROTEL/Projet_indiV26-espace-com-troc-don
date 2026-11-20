import type { Metadata } from 'next';
import { CartPlaceholderPage } from '../../components/prototype-commerce-placeholders';
export const metadata: Metadata = { title: 'Mon panier', robots: { index: false, follow: false } };
export default function Page(){ return <CartPlaceholderPage />; }
