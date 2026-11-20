import type { Metadata } from 'next';
import './management-v2.css';
import { ModerationSpace } from '../../components/moderation-space';

export const metadata: Metadata = {
  title: 'La réserve',
  description: 'Espace privé de modération des annonces.',
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

export default function ModerationPage() {
  return <ModerationSpace />;
}
