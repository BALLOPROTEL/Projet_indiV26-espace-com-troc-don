import { Global, Module } from '@nestjs/common';
import { MarketplaceEventPublisher } from './event-publisher.service';

@Global()
@Module({
  providers: [MarketplaceEventPublisher],
  exports: [MarketplaceEventPublisher],
})
export class EventsModule {}
