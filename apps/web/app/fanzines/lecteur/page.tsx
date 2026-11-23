import type { Metadata } from 'next';
import { ReaderPlaceholderPage } from '../../../components/prototype-commerce-placeholders';
export const metadata: Metadata = { title: 'Lecteur fanzine', robots: { index: false, follow: false } };
export default function Page(){ return <ReaderPlaceholderPage />; }
