import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { StripeClientService } from './stripe-client.service';

describe('StripeClientService webhook verification', () => {
  const secret = 'whsec_test_secret';
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') {
        return secret;
      }
      if (key === 'STRIPE_SECRET_KEY') {
        return 'sk_test_secret';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new StripeClientService(config);

  it('accepts a current HMAC SHA-256 Stripe signature', () => {
    const body = Buffer.from(JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
        },
      },
    }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${body.toString('utf8')}`)
      .digest('hex');

    expect(
      service.verifyWebhook(
        body,
        `t=${timestamp},v1=${signature}`,
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'evt_1',
        type: 'checkout.session.completed',
      }),
    );
  });

  it('rejects an invalid signature', () => {
    const body = Buffer.from(JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: {} },
    }));
    const timestamp = Math.floor(Date.now() / 1000);

    expect(() =>
      service.verifyWebhook(
        body,
        `t=${timestamp},v1=${'0'.repeat(64)}`,
      ),
    ).toThrow(BadRequestException);
  });
});
