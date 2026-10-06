import { Module } from '@nestjs/common';
import { MarketplaceRulesService } from './marketplace-rules.service';

@Module({
  providers: [MarketplaceRulesService],
  exports: [MarketplaceRulesService],
})
export class MarketplaceModule {}
