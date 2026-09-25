import type { Metadata } from 'next';
import { ListingDetail } from '../../../components/listing-detail';

export const metadata: Metadata = {
  title: 'Fiche annonce',
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ListingDetail id={id} />;
}
