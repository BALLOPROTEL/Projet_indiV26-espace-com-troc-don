import type { Metadata } from 'next';
import { AdminProductCatalog } from '../../../components/admin-product-catalog';
import '../admin-v2.css';
import './admin-products.css';

export const metadata: Metadata = {
  title: 'Administration boutique',
  description: 'Gestion sécurisée du catalogue commercial.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminBoutiquePage() {
  return <AdminProductCatalog />;
}
