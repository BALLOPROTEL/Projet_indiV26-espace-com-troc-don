import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = {
  status: 'ok';
  service: 'api';
};

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  liveness(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
    };
  }

  @Get('ready')
  async readiness(): Promise<HealthResponse> {
    try {
      await this.prisma.ping();

      return {
        status: 'ok',
        service: 'api',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'api',
        dependency: 'postgresql',
      });
    }
  }
}
