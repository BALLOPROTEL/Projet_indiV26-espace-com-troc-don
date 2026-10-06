import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config
      .get<string>('INTERNAL_SERVICE_TOKEN')
      ?.trim();

    if (!expected) {
      throw new ServiceUnavailableException(
        'Internal service authentication is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = request.headers['x-internal-service-token'];
    const provided = Array.isArray(raw) ? raw[0] : raw;

    if (!provided || !this.matches(provided, expected)) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }

  private matches(provided: string, expected: string): boolean {
    const left = Buffer.from(provided);
    const right = Buffer.from(expected);

    return left.length === right.length && timingSafeEqual(left, right);
  }
}
