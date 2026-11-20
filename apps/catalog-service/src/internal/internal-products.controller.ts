import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { InternalServiceGuard } from './internal-service.guard';

@UseGuards(InternalServiceGuard)
@Controller('internal/products')
export class InternalProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get(':productId/variants/:variantId')
  findVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.products.getInternalVariantSnapshot(
      productId,
      variantId,
    );
  }
}
