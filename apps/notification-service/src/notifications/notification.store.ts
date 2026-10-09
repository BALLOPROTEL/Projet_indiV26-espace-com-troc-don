import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { NotificationPrismaService } from '../prisma/prisma.service';
import type { MarketplaceEventEnvelope } from './event-contract';

export type ReceivedNotification = {
  receivedAt: string;
  event: MarketplaceEventEnvelope;
};

/**
 * A shared, durable inbox. PostgreSQL's unique eventId index arbitrates races
 * between Notification replicas; RabbitMQ is acked only AFTER its transaction
 * commits. Keeping all IDs avoids re-processing replayed old deliveries after
 * they fall outside the 50-event presentation window.
 */
@Injectable()
export class NotificationStore {
  constructor(private readonly prisma: NotificationPrismaService) {}

  async record(event: MarketplaceEventEnvelope): Promise<boolean> {
    const result = await this.prisma.notificationEvent.createMany({
      data: [{
        eventId: event.eventId,
        event: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
      }],
      skipDuplicates: true,
    });

    return result.count === 1;
  }

  async recent(): Promise<ReceivedNotification[]> {
    const items = await this.prisma.notificationEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { eventId: 'desc' }],
      take: 50,
    });

    return items.map((item) => ({
      receivedAt: item.receivedAt.toISOString(),
      event: structuredClone(item.event) as MarketplaceEventEnvelope,
    }));
  }
}
