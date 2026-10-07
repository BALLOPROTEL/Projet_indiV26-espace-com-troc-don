import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';

@Controller('health')
export class HealthController {
  constructor(private readonly rabbitmq: RabbitMqConsumer) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'notification-service',
    };
  }

  @Get('ready')
  ready() {
    if (!this.rabbitmq.isReady()) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'notification-service',
        unavailable: ['rabbitmq'],
      });
    }

    return {
      status: 'ready',
      service: 'notification-service',
      dependencies: ['rabbitmq'],
    };
  }
}
