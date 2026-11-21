import { ConfigService } from '@nestjs/config';
import type { CatalogClientService } from '../catalog/catalog-client.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import type { StripeClientService } from './stripe-client.service';

describe('PaymentsService', () => {
  const prisma = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const catalog = {
    extendStock: jest.fn(),
    commitStock: jest.fn(),
  } as unknown as CatalogClientService;

  const stripe = {
    createCheckoutSession: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    verifyWebhook: jest.fn(),
  } as unknown as StripeClientService;

  const service = new PaymentsService(
    prisma,
    catalog,
    stripe,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEB_PUBLIC_URL =
      'https://example.test';
    (prisma.paymentWebhookEvent.findUnique as jest.Mock)
      .mockResolvedValue(null);
  });

  it('extends stock before creating a hosted Checkout session', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'AWAITING_PAYMENT',
      reservationExpiresAt:
        new Date('2099-01-01T00:00:00.000Z'),
      paymentSessionId: null,
      email: 'user@example.test',
      items: [{
        productName: 'Produit',
        variantLabel: 'Standard',
        unitPriceCents: 2500,
        quantity: 2,
      }],
    });
    (catalog.extendStock as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: 'ACTIVE',
      expiresAt: '2099-01-01T00:35:00.000Z',
      items: [],
    });
    (stripe.createCheckoutSession as jest.Mock)
      .mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/test',
        status: 'open',
        payment_status: 'unpaid',
        expires_at: 4070908800,
        client_reference_id: 'order-1',
        payment_intent: null,
        metadata: { orderId: 'order-1' },
      });
    (prisma.order.update as jest.Mock).mockResolvedValue({});

    const result = await service.createSession(
      'user-1',
      'order-1',
    );

    expect(catalog.extendStock).toHaveBeenCalledWith(
      'order-1',
    );
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        email: 'user@example.test',
        items: [{
          name: 'Produit',
          variantLabel: 'Standard',
          unitPriceCents: 2500,
          quantity: 2,
        }],
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          paymentSessionId: 'cs_test_1',
        }),
      }),
    );
    expect(result.url).toBe(
      'https://checkout.stripe.com/test',
    );
  });

  it('commits stock and marks the order PAID only from a verified paid webhook', async () => {
    (stripe.verifyWebhook as jest.Mock).mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          url: null,
          status: 'complete',
          payment_status: 'paid',
          expires_at: 4070908800,
          client_reference_id: 'order-1',
          payment_intent: 'pi_1',
          metadata: {
            orderId: 'order-1',
          },
        },
      },
    });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      status: 'AWAITING_PAYMENT',
      paymentSessionId: 'cs_test_1',
      items: [],
    });
    (catalog.commitStock as jest.Mock).mockResolvedValue({
      status: 'COMMITTED',
    });
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    await expect(
      service.processWebhook(
        Buffer.from('{}'),
        't=1,v1=abc',
      ),
    ).resolves.toEqual({ received: true });

    expect(catalog.commitStock).toHaveBeenCalledWith(
      'order-1',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not process the same Stripe event twice', async () => {
    (stripe.verifyWebhook as jest.Mock).mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    (prisma.paymentWebhookEvent.findUnique as jest.Mock)
      .mockResolvedValue({
        id: 'stored',
        providerEventId: 'evt_duplicate',
      });

    await expect(
      service.processWebhook(
        Buffer.from('{}'),
        'signature',
      ),
    ).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    expect(catalog.commitStock).not.toHaveBeenCalled();
  });
});
