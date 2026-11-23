import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { InternalProductsController } from './internal-products.controller';
import { ProductStockReservationsController } from './product-stock-reservations.controller';
import { ProductStockReservationsService } from './product-stock-reservations.service';
import { InternalListingsController } from './internal-listings.controller';
import { InternalListingsService } from './internal-listings.service';
import { InternalServiceGuard } from './internal-service.guard';

@Module({
  imports: [ProductsModule],
  controllers: [
    InternalListingsController,
    InternalProductsController,
    ProductStockReservationsController,
  ],
  providers: [
    InternalListingsService,
    ProductStockReservationsService,
    InternalServiceGuard,
  ],
})
export class InternalModule {}
