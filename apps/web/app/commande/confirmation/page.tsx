import type { Metadata } from 'next';
import { OrderConfirmationPage } from '../../../components/order-confirmation-page';

export const metadata: Metadata = {
  title: 'Confirmation de commande',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    payment?: string;
  }>;
}) {
  const { id, payment } = await searchParams;

  return (
    <OrderConfirmationPage
      orderId={id ?? null}
      paymentResult={
        payment === 'success' || payment === 'cancel'
          ? payment
          : null
      }
    />
  );
}
