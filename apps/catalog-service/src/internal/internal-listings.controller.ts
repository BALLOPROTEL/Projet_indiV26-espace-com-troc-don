import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceGuard } from './internal-service.guard';
import { InternalListingsService } from './internal-listings.service';

@UseGuards(InternalServiceGuard)
@Controller('internal/listings')
export class InternalListingsController {
  constructor(private readonly listings: InternalListingsService) {}

  @Get('owner/:ownerId/ids')
  findOwnedIds(@Param('ownerId') ownerId: string) {
    return this.listings.getOwnedIds(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listings.getSnapshot(id);
  }

  @Post(':id/reserve')
  reserve(@Param('id') id: string) {
    return this.listings.reserve(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.listings.complete(id);
  }

  @Post(':id/release')
  release(@Param('id') id: string) {
    return this.listings.release(id);
  }
}
