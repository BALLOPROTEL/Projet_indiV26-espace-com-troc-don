import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('health')
class HealthController {
  @Get('live')
  live() {
    return { status: 'ok', service: 'marketplace-service' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: 'marketplace-service' };
  }
}

@Module({
  controllers: [HealthController],
})
class MarketplaceModule {}

async function bootstrap() {
  const app = await NestFactory.create(MarketplaceModule);
  const port = Number(process.env.PORT ?? 3102);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
