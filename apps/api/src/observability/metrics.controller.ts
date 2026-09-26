import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('observability')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4; charset=utf-8',
  )
  @ApiOperation({
    summary: 'Exposer les métriques Prometheus de l’API',
  })
  metrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
