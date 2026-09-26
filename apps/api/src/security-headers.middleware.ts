import { Injectable, NestMiddleware } from '@nestjs/common';

type ResponseLike = {
  removeHeader: (name: string) => void;
  setHeader: (name: string, value: string) => void;
};

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(
    _request: unknown,
    response: ResponseLike,
    next: () => void,
  ): void {
    response.removeHeader('X-Powered-By');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );

    next();
  }
}
