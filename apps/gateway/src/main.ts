import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('health')
class HealthController {
  @Get('live')
  live() {
    return { status: 'ok', service: 'gateway' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: 'gateway' };
  }
}

@Module({
  controllers: [HealthController],
})
class GatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
