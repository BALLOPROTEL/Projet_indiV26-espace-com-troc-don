import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReserveProductStockDto } from './dto/reserve-product-stock.dto';
import { InternalServiceGuard } from './internal-service.guard';
import { ProductStockReservationsService } from './product-stock-reservations.service';

@UseGuards(InternalServiceGuard)
@Controller('internal/product-stock-reservations')
export class ProductStockReservationsController {
  constructor(
    private readonly reservations:
      ProductStockReservationsService,
  ) {}

  @Post()
  reserve(@Body() input: ReserveProductStockDto) {
    return this.reservations.reserve(input);
  }

  @Post(':orderId/extend')
  extend(@Param('orderId') orderId: string) {
    return this.reservations.extend(orderId);
  }

  @Post(':orderId/release')
  release(@Param('orderId') orderId: string) {
    return this.reservations.release(orderId);
  }

  @Post(':orderId/commit')
  commit(@Param('orderId') orderId: string) {
    return this.reservations.commit(orderId);
  }
}
