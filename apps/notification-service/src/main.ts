import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('health')
class HealthController {
  @Get('live')
  live() {
    return { status: 'ok', service: 'notification-service' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: 'notification-service' };
  }
}

@Module({
  controllers: [HealthController],
})
class NotificationModule {}

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule);
  const port = Number(process.env.PORT ?? 3103);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
