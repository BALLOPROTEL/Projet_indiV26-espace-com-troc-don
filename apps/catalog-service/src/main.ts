import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('health')
class HealthController {
  @Get('live')
  live() {
    return { status: 'ok', service: 'catalog-service' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: 'catalog-service' };
  }
}

@Module({
  controllers: [HealthController],
})
class CatalogModule {}

async function bootstrap() {
  const app = await NestFactory.create(CatalogModule);
  const port = Number(process.env.PORT ?? 3101);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
