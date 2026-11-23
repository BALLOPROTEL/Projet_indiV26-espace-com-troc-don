import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeClientService } from './stripe-client.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [AuthModule, CatalogModule, PrismaModule],
  controllers: [
    PaymentsController,
    StripeWebhookController,
  ],
  providers: [
    PaymentsService,
    StripeClientService,
  ],
  exports: [StripeClientService],
})
export class PaymentsModule {}
