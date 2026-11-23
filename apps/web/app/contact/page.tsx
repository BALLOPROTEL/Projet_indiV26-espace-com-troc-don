import type { Metadata } from 'next';
import { ConnectedContactPage } from '../../components/connected-contact-page';
import type { PrivacyAction } from '../../lib/types';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contacter La Petite Maison de l’Épouvante.',
  alternates: { canonical: '/contact' },
};

function privacyAction(
  subject: string | undefined,
  request: string | undefined,
): PrivacyAction | null {
  if (subject !== 'privacy') return null;

  switch (request) {
    case 'export':
      return 'EXPORT';
    case 'rectify':
      return 'RECTIFY';
    case 'anonymize':
      return 'ANONYMIZE';
    case 'erase':
      return 'ERASE';
    default:
      return 'ACCESS';
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    request?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <ConnectedContactPage
      initialPrivacyAction={privacyAction(
        params.subject,
        params.request,
      )}
    />
  );
}
