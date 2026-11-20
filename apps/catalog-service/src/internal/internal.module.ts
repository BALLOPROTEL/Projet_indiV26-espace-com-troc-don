import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { InternalProductsController } from './internal-products.controller';
import { InternalListingsController } from './internal-listings.controller';
import { InternalListingsService } from './internal-listings.service';
import { InternalServiceGuard } from './internal-service.guard';

@Module({
  imports: [ProductsModule],
  controllers: [
    InternalListingsController,
    InternalProductsController,
  ],
  providers: [InternalListingsService, InternalServiceGuard],
})
export class InternalModule {}
