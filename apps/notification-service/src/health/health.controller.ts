import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';
import { NotificationStore } from '../notifications/notification.store';

@Controller('health')
export class HealthController {
  constructor(
    private readonly rabbitmq: RabbitMqConsumer,
    private readonly store: NotificationStore,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'notification-service',
    };
  }

  @Get('ready')
  async ready() {
    if (!this.rabbitmq.isReady()) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'notification-service',
        unavailable: ['rabbitmq'],
      });
    }

    try {
      await this.store.checkReady();
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'notification-service',
        unavailable: ['postgresql'],
      });
    }

    return {
      status: 'ready',
      service: 'notification-service',
      dependencies: ['rabbitmq', 'postgresql'],
    };
  }
}
