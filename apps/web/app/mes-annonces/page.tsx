import type { Metadata } from 'next';
import '../espace/space-v3.css';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Mes annonces',
  description: 'Suivre et corriger mes annonces.',
  robots: { index: false, follow: false, nocache: true },
};

export default function MyListingsPage() {
  return <PersonalSpace view="listings" />;
}
