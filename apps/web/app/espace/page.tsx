import type { Metadata } from 'next';
import './space-v3.css';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Mon espace',
  description: 'Espace personnel réservé aux membres connectés.',
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

export default function PersonalSpacePage() {
  return <PersonalSpace />;
}
