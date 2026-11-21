import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StripeClientService,
  type StripeCheckoutSession,
  type StripeWebhookEvent,
} from './stripe-client.service';

const orderInclude = {
  items: {
    orderBy: [
      { createdAt: 'asc' as const },
      { id: 'asc' as const },
    ],
  },
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogClientService,
    private readonly stripe: StripeClientService,
  ) {}

  async createSession(
    userId: string,
    orderId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'PAID') {
      throw new ConflictException(
        'Order is already paid',
      );
    }

    if (order.status !== 'AWAITING_PAYMENT') {
      throw new ConflictException(
        'Order must have active reserved stock before payment',
      );
    }

    if (
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= new Date()
    ) {
      throw new ConflictException(
        'Stock reservation has expired',
      );
    }

    if (order.paymentSessionId) {
      const existing =
        await this.stripe.retrieveCheckoutSession(
          order.paymentSessionId,
        );

      if (existing.status === 'open' && existing.url) {
        return this.toSessionView(existing);
      }

      if (
        existing.status === 'complete' &&
        existing.payment_status === 'paid'
      ) {
        throw new ConflictException(
          'Payment confirmation is being processed',
        );
      }

      throw new ConflictException(
        'Stripe Checkout session is no longer payable',
      );
    }

    const reservation =
      await this.catalog.extendStock(order.id);
    const checkoutExpiresAt = new Date(
      Date.now() + 30 * 60 * 1000,
    );
    const webUrl = this.webUrl();
    const returnUrl =
      `${webUrl}/commande/confirmation?id=${encodeURIComponent(order.id)}`;

    const session =
      await this.stripe.createCheckoutSession({
        orderId: order.id,
        email: order.email,
        successUrl: `${returnUrl}&payment=success`,
        cancelUrl: `${returnUrl}&payment=cancel`,
        expiresAt: checkoutExpiresAt,
        items: order.items.map((item) => ({
          name: item.productName,
          variantLabel: item.variantLabel,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
        })),
      });

    if (!session.url) {
      throw new ConflictException(
        'Stripe Checkout URL is unavailable',
      );
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentSessionId: session.id,
        reservationExpiresAt: new Date(
          reservation.expiresAt,
        ),
      },
    });

    return this.toSessionView(session);
  }

  async processWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ) {
    const event = this.stripe.verifyWebhook(
      rawBody,
      signature,
    );

    const existing =
      await this.prisma.paymentWebhookEvent.findUnique({
        where: {
          providerEventId: event.id,
        },
      });

    if (existing) {
      return { received: true, duplicate: true };
    }

    if (event.type !== 'checkout.session.completed') {
      await this.recordEvent(event, null);
      return { received: true };
    }

    const session = this.sessionFromEvent(event);

    if (session.payment_status !== 'paid') {
      await this.recordEvent(
        event,
        session.client_reference_id,
      );
      return { received: true };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        paymentSessionId: session.id,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException(
        'Order for Stripe session not found',
      );
    }

    const referencedOrderId =
      session.metadata?.orderId ??
      session.client_reference_id;

    if (
      !referencedOrderId ||
      referencedOrderId !== order.id
    ) {
      throw new ConflictException(
        'Stripe Checkout order reference mismatch',
      );
    }

    if (order.status === 'PAID') {
      await this.recordEvent(event, order.id);
      return { received: true };
    }

    if (order.status !== 'AWAITING_PAYMENT') {
      throw new ConflictException(
        'Order is not awaiting payment',
      );
    }

    await this.catalog.commitStock(order.id);

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    try {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paymentIntentId,
            paidAt: new Date(),
          },
        }),
        this.prisma.paymentWebhookEvent.create({
          data: {
            providerEventId: event.id,
            type: event.type,
            orderId: order.id,
          },
        }),
      ]);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return { received: true, duplicate: true };
      }

      throw error;
    }

    return { received: true };
  }

  private async recordEvent(
    event: StripeWebhookEvent,
    orderId: string | null,
  ) {
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          providerEventId: event.id,
          type: event.type,
          orderId,
        },
      });
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }
  }

  private sessionFromEvent(
    event: StripeWebhookEvent,
  ): StripeCheckoutSession {
    const value = event.data.object;
    const session = {
      id: value.id,
      url: value.url ?? null,
      status: value.status ?? null,
      payment_status: value.payment_status,
      expires_at: value.expires_at,
      client_reference_id:
        value.client_reference_id ?? null,
      payment_intent:
        value.payment_intent ?? null,
      metadata: value.metadata,
    };

    if (
      typeof session.id !== 'string' ||
      (session.url !== null &&
        typeof session.url !== 'string') ||
      (session.status !== null &&
        session.status !== 'open' &&
        session.status !== 'complete' &&
        session.status !== 'expired') ||
      (session.payment_status !== 'paid' &&
        session.payment_status !== 'unpaid' &&
        session.payment_status !== 'no_payment_required') ||
      !Number.isSafeInteger(session.expires_at) ||
      (session.client_reference_id !== null &&
        typeof session.client_reference_id !== 'string') ||
      (session.metadata !== undefined &&
        (session.metadata === null ||
          typeof session.metadata !== 'object'))
    ) {
      throw new ConflictException(
        'Invalid Stripe Checkout webhook payload',
      );
    }

    return session as StripeCheckoutSession;
  }

  private toSessionView(
    session: StripeCheckoutSession,
  ) {
    if (!session.url) {
      throw new ConflictException(
        'Stripe Checkout URL is unavailable',
      );
    }

    return {
      sessionId: session.id,
      url: session.url,
      expiresAt: new Date(
        session.expires_at * 1000,
      ).toISOString(),
    };
  }

  private webUrl(): string {
    const value =
      process.env.WEB_PUBLIC_URL?.trim() ||
      'http://localhost:3001';

    return value.replace(/\/$/, '');
  }
}
