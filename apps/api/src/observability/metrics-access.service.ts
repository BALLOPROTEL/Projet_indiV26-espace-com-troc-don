import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class MetricsAccessService {
  private readonly token?: string;
  private readonly production: boolean;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('METRICS_TOKEN')?.trim();
    this.production =
      this.config.get<string>('NODE_ENV') === 'production';
  }

  assertAuthorized(authorization?: string): void {
    if (!this.token) {
      if (this.production) {
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
      !this.safeEquals(candidate, this.token)
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
