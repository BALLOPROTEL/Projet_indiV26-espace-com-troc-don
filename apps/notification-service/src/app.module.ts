import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationStore } from './notifications/notification.store';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';

@Module({
  controllers: [HealthController, NotificationsController],
  providers: [NotificationStore, RabbitMqConsumer],
})
export class AppModule {}
