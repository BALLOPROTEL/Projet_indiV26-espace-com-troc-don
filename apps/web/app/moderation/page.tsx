import type { Metadata } from 'next';
import { ModerationSpace } from '../../components/moderation-space';

export const metadata: Metadata = {
  title: 'La réserve',
};

export default function ModerationPage() {
  return <ModerationSpace />;
}
