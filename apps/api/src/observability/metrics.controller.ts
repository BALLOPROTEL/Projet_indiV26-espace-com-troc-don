import { Controller, Get, Header, Headers } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetricsAccessService } from './metrics-access.service';
import { MetricsService } from './metrics.service';

@ApiTags('observability')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly metricsAccess: MetricsAccessService,
  ) {}

  @Get()
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4; charset=utf-8',
  )
  @ApiOperation({
    summary: 'Exposer les métriques Prometheus de l’API',
  })
  metrics(
    @Headers('authorization') authorization?: string,
  ): Promise<string> {
    this.metricsAccess.assertAuthorized(authorization);
    return this.metricsService.metrics();
  }
}
