import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationStore } from './notifications/notification.store';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { NotificationPrismaService } from './prisma/prisma.service';
import { InternalPrivacyGuard } from './privacy/internal-privacy.guard';
import { PrivacyController } from './privacy/privacy.controller';
import { PrivacyService } from './privacy/privacy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
  ],
  controllers: [HealthController, NotificationsController, PrivacyController],
  providers: [
    NotificationPrismaService,
    NotificationStore,
    RabbitMqConsumer,
    PrivacyService,
    InternalPrivacyGuard,
  ],
})
export class AppModule {}
