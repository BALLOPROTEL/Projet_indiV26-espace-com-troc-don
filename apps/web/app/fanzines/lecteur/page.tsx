import type { Metadata } from 'next';
import { FanzineReader } from '../../../components/connected-editorial-pages';

export const metadata: Metadata = {
  title: 'Lecteur fanzine',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const params = await searchParams;
  return <FanzineReader slug={params.slug?.trim() || null} />;
}
