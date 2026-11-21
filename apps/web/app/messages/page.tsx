import type { Metadata } from 'next';
import { ConversationsPage } from '../../components/conversations-page';

export const metadata: Metadata = {
  title: 'Messages & échanges',
  description: 'Conversations privées liées à mes dons et trocs.',
  robots: { index: false, follow: false, nocache: true },
};

export default function MessagesPage() {
  return <ConversationsPage />;
}
