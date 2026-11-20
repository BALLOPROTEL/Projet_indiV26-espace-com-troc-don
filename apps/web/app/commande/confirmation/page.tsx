import type { Metadata } from 'next';
import { ConfirmationPlaceholderPage } from '../../../components/prototype-commerce-placeholders';
export const metadata: Metadata = { title: 'Confirmation de commande', robots: { index: false, follow: false } };
export default function Page(){ return <ConfirmationPlaceholderPage />; }
