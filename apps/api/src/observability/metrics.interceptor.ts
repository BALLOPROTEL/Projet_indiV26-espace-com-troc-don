import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

type HttpRequest = {
  method?: string;
  baseUrl?: string;
  route?: {
    path?: string;
  };
};

type HttpResponse = {
  statusCode?: number;
};

type HttpError = {
  getStatus?: () => number;
};

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const startedAt = process.hrtime.bigint();

    const method = request.method ?? 'UNKNOWN';
    const route = this.routeLabel(request);

    const record = (statusCode: number): void => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

      this.metrics.observeHttpRequest(
        {
          method,
          route,
          statusCode,
        },
        durationSeconds,
      );
    };

    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode ?? 200),
        error: (error: HttpError) =>
          record(
            typeof error?.getStatus === 'function'
              ? error.getStatus()
              : 500,
          ),
      }),
    );
  }

  private routeLabel(request: HttpRequest): string {
    const baseUrl = request.baseUrl ?? '';
    const routePath = request.route?.path ?? '';

    if (routePath) {
      return `${baseUrl}${routePath}`;
    }

    return 'unknown';
  }
}
