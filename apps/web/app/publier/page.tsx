import type { Metadata } from 'next';
import '../espace/space-v3.css';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Publier une annonce',
  description: 'Déposer une annonce de don ou de troc.',
  robots: { index: false, follow: false, nocache: true },
};

export default function PublishListingPage() {
  return <PersonalSpace view="publish" />;
}
