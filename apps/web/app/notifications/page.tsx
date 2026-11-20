import type { Metadata } from 'next';
import { NotificationsPlaceholderPage } from '../../components/prototype-account-placeholders';
export const metadata: Metadata = { title: 'Mes notifications', robots: { index: false, follow: false, nocache: true } };
export default function Page(){ return <NotificationsPlaceholderPage />; }
