import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { NotificationPrismaService } from '../prisma/prisma.service';
import type { MarketplaceEventEnvelope } from './event-contract';

export type ReceivedNotification = {
  receivedAt: string;
  event: MarketplaceEventEnvelope;
};

export function notificationRecipients(
  event: MarketplaceEventEnvelope,
): string[] {
  const recipients = (() => {
    switch (event.type) {
      case 'proposal.created':
        return event.data.ownerId ? [event.data.ownerId] : [];
      case 'proposal.accepted':
      case 'proposal.rejected':
        return [event.data.requesterId];
      case 'transaction.completed':
        return [event.data.ownerId, event.data.requesterId];
    }
  })();

  return [...new Set(recipients.filter((id) => id.trim().length > 0))];
}

/**
 * Durable technical inbox plus user-scoped projection metadata.
 * eventId remains the global deduplication key; recipientIds is derived only
 * from the validated event envelope and never from a client request.
 */
@Injectable()
export class NotificationStore {
  constructor(private readonly prisma: NotificationPrismaService) {}

  async record(event: MarketplaceEventEnvelope): Promise<boolean> {
    const result = await this.prisma.notificationEvent.createMany({
      data: [{
        eventId: event.eventId,
        event: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        recipientIds: notificationRecipients(event),
      }],
      skipDuplicates: true,
    });

    return result.count === 1;
  }

  async checkReady(): Promise<void> {
    await this.prisma.checkReady();
  }

  async recent(): Promise<ReceivedNotification[]> {
    const items = await this.prisma.notificationEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { eventId: 'desc' }],
      take: 50,
    });

    return items.map((item) => this.toReceived(item));
  }

  async recentForUser(userId: string): Promise<ReceivedNotification[]> {
    const items = await this.prisma.notificationEvent.findMany({
      where: {
        recipientIds: { has: userId },
      },
      orderBy: [{ receivedAt: 'desc' }, { eventId: 'desc' }],
      take: 50,
    });

    return items.map((item) => this.toReceived(item));
  }

  private toReceived(item: {
    receivedAt: Date;
    event: Prisma.JsonValue;
  }): ReceivedNotification {
    return {
      receivedAt: item.receivedAt.toISOString(),
      event: structuredClone(item.event) as unknown as MarketplaceEventEnvelope,
    };
  }
}
