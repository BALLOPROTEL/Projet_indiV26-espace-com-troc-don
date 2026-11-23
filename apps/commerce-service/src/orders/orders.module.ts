import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    CartModule,
    CatalogModule,
    PaymentsModule,
    PrismaModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
