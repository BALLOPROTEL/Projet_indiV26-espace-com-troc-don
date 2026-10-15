import type { Metadata } from 'next';
import './management-v2.css';
import { ModerationSpace } from '../../components/moderation-space';

export const metadata: Metadata = {
  title: 'La réserve',
};

export default function ModerationPage() {
  return <ModerationSpace />;
}
