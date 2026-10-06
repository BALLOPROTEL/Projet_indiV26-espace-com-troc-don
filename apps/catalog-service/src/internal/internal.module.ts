import { Module } from '@nestjs/common';
import { InternalListingsController } from './internal-listings.controller';
import { InternalListingsService } from './internal-listings.service';
import { InternalServiceGuard } from './internal-service.guard';

@Module({
  controllers: [InternalListingsController],
  providers: [InternalListingsService, InternalServiceGuard],
})
export class InternalModule {}
