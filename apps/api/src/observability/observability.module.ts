import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SecurityHeadersMiddleware } from '../security-headers.middleware';
import { MetricsAccessService } from './metrics-access.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsAccessService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityHeadersMiddleware, RequestLoggingMiddleware)
      .forRoutes({
      path: '{*splat}',
        method: RequestMethod.ALL,
      });
  }
}
