import { Global, Module } from '@nestjs/common';
import { MarketplaceEventPublisher } from './event-publisher.service';
import { MarketplaceOutboxWorker } from './outbox.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [MarketplaceEventPublisher, MarketplaceOutboxWorker],
  exports: [MarketplaceEventPublisher],
})
export class EventsModule {}
