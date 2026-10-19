import type { Metadata } from 'next';
import './space-v3.css';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Mon étagère',
};

export default function PersonalSpacePage() {
  return <PersonalSpace />;
}
