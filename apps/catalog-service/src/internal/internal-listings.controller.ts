import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from './internal-service.guard';
import { InternalListingsService } from './internal-listings.service';

@UseGuards(InternalServiceGuard)
@Controller('internal/listings')
export class InternalListingsController {
  constructor(private readonly listings: InternalListingsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listings.getSnapshot(id);
  }
}
