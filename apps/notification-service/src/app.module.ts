import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationStore } from './notifications/notification.store';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  controllers: [HealthController, NotificationsController],
  providers: [NotificationStore, RabbitMqConsumer],
})
export class AppModule {}
