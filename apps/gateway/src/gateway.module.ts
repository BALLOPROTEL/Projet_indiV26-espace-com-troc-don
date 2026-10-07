import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { GatewayMetrics } from './observability';

@Module({
  controllers: [HealthController, MetricsController],
  providers: [GatewayMetrics],
})
export class GatewayModule {}
