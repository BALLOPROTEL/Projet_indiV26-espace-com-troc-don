import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  on: (event: 'finish', listener: () => void) => void;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(
    request: RequestLike,
    response: ResponseLike,
    next: () => void,
  ): void {
    const requestId = this.resolveRequestId(
      request.headers?.['x-request-id'],
    );
    const startedAt = process.hrtime.bigint();

    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const path =
        request.originalUrl?.split('?')[0] ?? 'unknown';

      process.stdout.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          event: 'http_request',
          request_id: requestId,
          method: request.method ?? 'UNKNOWN',
          path,
          status_code: response.statusCode ?? 0,
          duration_ms: Number(durationMs.toFixed(2)),
        })}\n`,
      );
    });

    next();
  }

  private resolveRequestId(
    candidate: string | string[] | undefined,
  ): string {
    const value = Array.isArray(candidate)
      ? candidate[0]
      : candidate;

    if (
      typeof value === 'string' &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(value)
    ) {
      return value;
    }

    return randomUUID();
  }
}
