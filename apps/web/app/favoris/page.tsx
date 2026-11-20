import type { Metadata } from 'next';
import { FavoritesPlaceholderPage } from '../../components/prototype-account-placeholders';
export const metadata: Metadata = { title: 'Mes favoris', robots: { index: false, follow: false, nocache: true } };
export default function Page(){ return <FavoritesPlaceholderPage />; }
