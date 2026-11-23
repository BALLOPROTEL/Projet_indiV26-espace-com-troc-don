import type { Metadata } from 'next';
import { AdminContentManager } from '../../../components/admin-content-manager';
import '../admin-v2.css';

export const metadata: Metadata = {
  title: 'Contenus & demandes',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Page() {
  return <AdminContentManager />;
}
