import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  expires_at: number;
  client_reference_id: string | null;
  payment_intent:
    | string
    | { id?: string }
    | null;
  metadata?: Record<string, string>;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

@Injectable()
export class StripeClientService {
  private readonly secretKey: string | null;
  private readonly webhookSecret: string | null;

  constructor(private readonly config: ConfigService) {
    this.secretKey =
      this.config.get<string>('STRIPE_SECRET_KEY')?.trim() ||
      null;
    this.webhookSecret =
      this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim() ||
      null;
  }

  async createCheckoutSession(input: {
    orderId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
    items: Array<{
      name: string;
      variantLabel: string;
      unitPriceCents: number;
      quantity: number;
    }>;
  }): Promise<StripeCheckoutSession> {
    const body = new URLSearchParams();

    body.set('mode', 'payment');
    body.set('success_url', input.successUrl);
    body.set('cancel_url', input.cancelUrl);
    body.set('client_reference_id', input.orderId);
    body.set('customer_email', input.email);
    body.set('metadata[orderId]', input.orderId);
    body.set(
      'expires_at',
      String(Math.floor(input.expiresAt.getTime() / 1000)),
    );
    body.set('allowed_payment_method_types[0]', 'card');

    input.items.forEach((item, index) => {
      const prefix = `line_items[${index}]`;
      body.set(
        `${prefix}[price_data][currency]`,
        'eur',
      );
      body.set(
        `${prefix}[price_data][unit_amount]`,
        String(item.unitPriceCents),
      );
      body.set(
        `${prefix}[price_data][product_data][name]`,
        `${item.name} — ${item.variantLabel}`,
      );
      body.set(
        `${prefix}[quantity]`,
        String(item.quantity),
      );
    });

    return this.requestSession(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/x-www-form-urlencoded',
          'Idempotency-Key':
            `projet-indiv26-order-${input.orderId}`,
        },
        body,
      },
    );
  }

  retrieveCheckoutSession(
    sessionId: string,
  ): Promise<StripeCheckoutSession> {
    return this.requestSession(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' },
    );
  }

  async expireCheckoutSession(
    sessionId: string,
  ): Promise<StripeCheckoutSession> {
    const session = await this.retrieveCheckoutSession(
      sessionId,
    );

    if (
      session.status === 'expired' ||
      session.status === 'complete'
    ) {
      return session;
    }

    return this.requestSession(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
      { method: 'POST' },
    );
  }

  verifyWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): StripeWebhookEvent {
    const secret = this.webhookSecret;

    if (!secret) {
      throw new ServiceUnavailableException(
        'Stripe webhook is not configured',
      );
    }

    if (!signatureHeader) {
      throw new BadRequestException(
        'Stripe-Signature header is required',
      );
    }

    const values = signatureHeader
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const timestampValue = values
      .find((value) => value.startsWith('t='))
      ?.slice(2);
    const signatures = values
      .filter((value) => value.startsWith('v1='))
      .map((value) => value.slice(3));

    const timestamp = Number(timestampValue);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(nowSeconds - timestamp) > 300 ||
      signatures.length === 0
    ) {
      throw new BadRequestException(
        'Invalid Stripe webhook signature timestamp',
      );
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest();

    const valid = signatures.some((signature) => {
      if (!/^[a-f0-9]{64}$/i.test(signature)) {
        return false;
      }

      const candidate = Buffer.from(signature, 'hex');

      return (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
      );
    });

    if (!valid) {
      throw new BadRequestException(
        'Invalid Stripe webhook signature',
      );
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException(
        'Invalid Stripe webhook payload',
      );
    }

    if (
      !event ||
      typeof event !== 'object' ||
      typeof (event as Record<string, unknown>).id !== 'string' ||
      typeof (event as Record<string, unknown>).type !== 'string'
    ) {
      throw new BadRequestException(
        'Invalid Stripe webhook event',
      );
    }

    const data = (event as Record<string, unknown>).data;
    if (
      !data ||
      typeof data !== 'object' ||
      !('object' in data) ||
      !data.object ||
      typeof data.object !== 'object'
    ) {
      throw new BadRequestException(
        'Invalid Stripe webhook event data',
      );
    }

    return event as StripeWebhookEvent;
  }

  private async requestSession(
    url: string,
    options: RequestInit,
  ): Promise<StripeCheckoutSession> {
    const secret = this.secretKey;

    if (!secret) {
      throw new ServiceUnavailableException(
        'Stripe payments are not configured',
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${secret}`,
          ...(options.headers ?? {}),
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new BadGatewayException(
        'Stripe is unavailable',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Stripe returned HTTP ${response.status}`,
      );
    }

    if (!this.isCheckoutSession(body)) {
      throw new BadGatewayException(
        'Invalid Stripe Checkout response',
      );
    }

    return body;
  }

  private isCheckoutSession(
    value: unknown,
  ): value is StripeCheckoutSession {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;

    return (
      typeof item.id === 'string' &&
      (item.url === null || typeof item.url === 'string') &&
      (item.status === null ||
        item.status === 'open' ||
        item.status === 'complete' ||
        item.status === 'expired') &&
      (item.payment_status === 'paid' ||
        item.payment_status === 'unpaid' ||
        item.payment_status === 'no_payment_required') &&
      Number.isSafeInteger(item.expires_at)
    );
  }
}
