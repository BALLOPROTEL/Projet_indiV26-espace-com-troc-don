import { Injectable } from '@nestjs/common';
import { NotificationPrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: NotificationPrismaService) {}

  async anonymize(userId: string) {
    const removed = await this.prisma.$executeRawUnsafe(
      'DELETE FROM "notification_events" WHERE $1 = ANY("recipientIds") OR CAST("event" AS TEXT) LIKE $2',
      userId,
      '%' + userId + '%',
    );

    return { eventsRemoved: removed };
  }
}
