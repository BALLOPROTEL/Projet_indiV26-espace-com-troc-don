import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationStore } from './notifications/notification.store';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { NotificationPrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  controllers: [HealthController, NotificationsController],
  providers: [NotificationPrismaService, NotificationStore, RabbitMqConsumer],
})
export class AppModule {}
