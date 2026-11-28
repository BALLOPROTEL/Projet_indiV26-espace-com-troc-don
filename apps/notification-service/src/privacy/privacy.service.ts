import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { NotificationPrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: NotificationPrismaService) {}

  async anonymize(userId: string) {
    const removed = await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM "notification_events"
        WHERE ${userId} = ANY("recipientIds")
        OR CAST("event" AS TEXT) LIKE ${'%' + userId + '%'}`,
    );

    return { eventsRemoved: removed };
  }
}
