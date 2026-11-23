import type { Metadata } from 'next';
import { SettingsPlaceholderPage } from '../../components/prototype-account-placeholders';
export const metadata: Metadata = { title: 'Paramètres', robots: { index: false, follow: false, nocache: true } };
export default function Page(){ return <SettingsPlaceholderPage />; }
