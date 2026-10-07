import {
  Controller,
  Get,
  Header,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { GatewayMetrics } from './observability';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: GatewayMetrics) {}

  @Get()
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4; charset=utf-8',
  )
  getMetrics(
    @Headers('authorization') authorization?: string,
  ): string {
    this.assertAuthorized(authorization);
    return this.metrics.metrics();
  }

  private assertAuthorized(authorization?: string): void {
    const token = process.env.METRICS_TOKEN?.trim();
    const production = process.env.NODE_ENV === 'production';

    if (!token) {
      if (production) {
        throw new UnauthorizedException(
          'Metrics endpoint is not configured',
        );
      }
      return;
    }

    const [scheme, candidate, extra] =
      authorization?.trim().split(/\s+/) ?? [];

    if (
      scheme?.toLowerCase() !== 'bearer' ||
      !candidate ||
      extra ||
      !this.safeEquals(candidate, token)
    ) {
      throw new UnauthorizedException(
        'Valid metrics bearer token is required',
      );
    }
  }

  private safeEquals(candidate: string, expected: string): boolean {
    const left = Buffer.from(candidate);
    const right = Buffer.from(expected);

    return (
      left.length === right.length &&
      timingSafeEqual(left, right)
    );
  }
}
