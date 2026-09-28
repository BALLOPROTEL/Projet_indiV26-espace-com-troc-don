import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { StorageModule } from '../storage/storage.module';
import { ListingImagesController } from './listing-images.controller';
import { ListingImagesService } from './listing-images.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ModerationController } from './moderation.controller';

@Module({
  imports: [AuthModule, MarketplaceModule, StorageModule],
  controllers: [
    ListingsController,
    ListingImagesController,
    ModerationController,
  ],
  providers: [ListingsService, ListingImagesService],
  exports: [ListingsService, ListingImagesService],
})
export class ListingsModule {}
