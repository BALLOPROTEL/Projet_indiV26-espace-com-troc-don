import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { StorageModule } from '../storage/storage.module';
import { ListingImagesController } from './listing-images.controller';
import { ListingImagesService } from './listing-images.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { ModerationController } from './moderation.controller';
import { ListingReportsController, ModerationReportsController } from './listing-reports.controller';
import { ListingReportsService } from './listing-reports.service';

@Module({
  imports: [AuthModule, MarketplaceModule, StorageModule],
  controllers: [
    ListingsController,
    ListingImagesController,
    ModerationController,
    AdminCatalogController,
    ListingReportsController,
    ModerationReportsController,
  ],
  providers: [ListingsService, ListingImagesService, ListingReportsService],
  exports: [ListingsService, ListingImagesService],
})
export class ListingsModule {}
