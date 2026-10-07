import { Injectable } from '@nestjs/common';
import type { MarketplaceEventEnvelope } from './event-contract';

export type ReceivedNotification = {
  receivedAt: string;
  event: MarketplaceEventEnvelope;
};

@Injectable()
export class NotificationStore {
  private readonly items: ReceivedNotification[] = [];
  private readonly maxItems = 50;

  record(event: MarketplaceEventEnvelope): void {
    this.items.unshift({
      receivedAt: new Date().toISOString(),
      event,
    });

    if (this.items.length > this.maxItems) {
      this.items.length = this.maxItems;
    }
  }

  recent(): ReceivedNotification[] {
    return this.items.map((item) => ({
      receivedAt: item.receivedAt,
      event: {
        ...item.event,
        data: { ...item.event.data },
      },
    }));
  }
}
