import type { Metadata } from 'next';
import { AdminDashboard } from '../../components/admin-dashboard';
import './admin-v2.css';

export const metadata: Metadata = {
  title: 'Administration',
  description: 'Indicateurs réels du catalogue, accessibles aux administrateurs.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
