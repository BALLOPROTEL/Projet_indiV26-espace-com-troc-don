import { Injectable } from '@nestjs/common';
import type { MarketplaceEventEnvelope } from './event-contract';

export type ReceivedNotification = {
  receivedAt: string;
  event: MarketplaceEventEnvelope;
};

@Injectable()
export class NotificationStore {
  private readonly items: ReceivedNotification[] = [];
  private readonly eventIds = new Set<string>();
  private readonly maxItems = 50;

  record(event: MarketplaceEventEnvelope): boolean {
    if (this.eventIds.has(event.eventId)) {
      return false;
    }

    this.eventIds.add(event.eventId);
    this.items.unshift({
      receivedAt: new Date().toISOString(),
      event,
    });

    if (this.items.length > this.maxItems) {
      const removed = this.items.pop();
      if (removed) {
        this.eventIds.delete(removed.event.eventId);
      }
    }

    return true;
  }

  recent(): ReceivedNotification[] {
    return this.items.map((item) => ({
      receivedAt: item.receivedAt,
      event: {
        ...item.event,
        data: { ...item.event.data },
      } as MarketplaceEventEnvelope,
    }));
  }
}
