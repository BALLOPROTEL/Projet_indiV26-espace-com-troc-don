import type { Metadata } from 'next';
import { AdminDashboard } from '../../components/admin-dashboard';
import './admin-v2.css';

export const metadata: Metadata = {
  title: 'Administration',
  description: 'Indicateurs réels du catalogue, accessibles aux administrateurs.',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
