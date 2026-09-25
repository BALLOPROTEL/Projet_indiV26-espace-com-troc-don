import type { Metadata } from 'next';
import { PersonalSpace } from '../../components/personal-space';

export const metadata: Metadata = {
  title: 'Mon étagère',
};

export default function PersonalSpacePage() {
  return <PersonalSpace />;
}
