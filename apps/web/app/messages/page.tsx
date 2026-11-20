import type { Metadata } from 'next';
import '../espace/space-v3.css';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Messages & échanges',
  description: 'Suivre mes demandes et mes échanges.',
  robots: { index: false, follow: false, nocache: true },
};

export default function MessagesPage() {
  return <PersonalSpace view="exchanges" />;
}
