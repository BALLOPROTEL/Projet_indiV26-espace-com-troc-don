import type { Metadata } from 'next';
import { ProductPlaceholderPage } from '../../../components/prototype-commerce-placeholders';
export const metadata: Metadata = { title: 'Fiche produit', robots: { index: false, follow: false } };
export default function Page(){ return <ProductPlaceholderPage />; }
