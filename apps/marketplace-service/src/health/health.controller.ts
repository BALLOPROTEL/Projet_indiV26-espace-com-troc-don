import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketplaceEventPublisher } from '../events/event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: MarketplaceEventPublisher,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'marketplace-service',
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.ping();

    if (!this.events.isReady()) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'marketplace-service',
        unavailable: ['rabbitmq'],
      });
    }

    return {
      status: 'ready',
      service: 'marketplace-service',
      dependencies: [
        'postgresql:marketplace',
        'rabbitmq',
      ],
    };
  }
}
