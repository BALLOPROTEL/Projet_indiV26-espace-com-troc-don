import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'catalog-service' };
  }

  @Get('ready')
  async ready() {
    await Promise.all([
      this.prisma.ping(),
      this.storage.assertReady(),
    ]);

    return {
      status: 'ready',
      service: 'catalog-service',
      dependencies: ['postgresql:catalog', 'minio'],
    };
  }
}
