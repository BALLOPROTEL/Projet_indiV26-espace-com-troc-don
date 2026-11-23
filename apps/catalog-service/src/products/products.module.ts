import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import {
  AdminProductImagesController,
  ProductImagesController,
} from './product-images.controller';
import { ProductImagesService } from './product-images.service';
import {
  AdminProductsController,
  ProductsController,
} from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [
    ProductsController,
    ProductImagesController,
    AdminProductsController,
    AdminProductImagesController,
  ],
  providers: [ProductsService, ProductImagesService],
  exports: [ProductsService, ProductImagesService],
})
export class ProductsModule {}
