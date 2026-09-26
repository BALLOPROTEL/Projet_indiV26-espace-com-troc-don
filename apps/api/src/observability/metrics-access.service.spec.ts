import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsAccessService } from './metrics-access.service';

describe('MetricsAccessService', () => {
  const config = (
    values: Record<string, string | undefined>,
  ): ConfigService =>
    ({
      get: (key: string) => values[key],
    }) as unknown as ConfigService;

  it('allows local metrics when no token is configured outside production', () => {
    const access = new MetricsAccessService(
      config({ NODE_ENV: 'test' }),
    );

    expect(() => access.assertAuthorized()).not.toThrow();
  });

  it('rejects metrics in production when no token is configured', () => {
    const access = new MetricsAccessService(
      config({ NODE_ENV: 'production' }),
    );

    expect(() => access.assertAuthorized()).toThrow(
      UnauthorizedException,
    );
  });

  it('requires the configured bearer token', () => {
    const access = new MetricsAccessService(
      config({
        NODE_ENV: 'production',
        METRICS_TOKEN: 'secret-metrics-token',
      }),
    );

    expect(() =>
      access.assertAuthorized('Bearer wrong-token'),
    ).toThrow(UnauthorizedException);

    expect(() =>
      access.assertAuthorized('Bearer secret-metrics-token'),
    ).not.toThrow();
  });
});
