import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      status: 'ready',
      service: 'marketplace-service',
      dependencies: ['postgresql:marketplace'],
    };
  }
}
