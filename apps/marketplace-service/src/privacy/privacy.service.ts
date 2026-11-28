import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  MarketplaceTransactionStatus,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async preflight(userId: string) {
    const activeTransactions =
      await this.prisma.marketplaceTransaction.count({
        where: {
          status: MarketplaceTransactionStatus.IN_PROGRESS,
          OR: [
            { ownerId: userId },
            { requesterId: userId },
          ],
        },
      });

    return {
      canAnonymize: activeTransactions === 0,
      activeTransactions,
    };
  }

  async anonymize(userId: string, replacementId: string) {
    this.assertReplacement(replacementId);

    const preflight = await this.preflight(userId);
    if (!preflight.canAnonymize) {
      throw new ConflictException(
        'Active marketplace transaction must be completed or cancelled before anonymization',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const proposals = await tx.proposal.updateMany({
        where: { requesterId: userId },
        data: {
          requesterId: replacementId,
          message: null,
        },
      });
      const ownerTransactions =
        await tx.marketplaceTransaction.updateMany({
          where: { ownerId: userId },
          data: { ownerId: replacementId },
        });
      const requesterTransactions =
        await tx.marketplaceTransaction.updateMany({
          where: { requesterId: userId },
          data: { requesterId: replacementId },
        });
      const ownerConversations = await tx.conversation.updateMany({
        where: { ownerId: userId },
        data: { ownerId: replacementId },
      });
      const requesterConversations =
        await tx.conversation.updateMany({
          where: { requesterId: userId },
          data: { requesterId: replacementId },
        });
      const messages = await tx.conversationMessage.updateMany({
        where: { senderId: userId },
        data: {
          senderId: replacementId,
          body: '[message anonymisé à la demande du compte]',
        },
      });
      const outboxEventsRemoved = await tx.$executeRaw(
        Prisma.sql`DELETE FROM "MarketplaceOutboxEvent"
          WHERE CAST("payload" AS TEXT) LIKE ${'%' + userId + '%'}`,
      );

      return {
        proposals: proposals.count,
        ownerTransactions: ownerTransactions.count,
        requesterTransactions: requesterTransactions.count,
        ownerConversations: ownerConversations.count,
        requesterConversations: requesterConversations.count,
        messages: messages.count,
        outboxEventsRemoved,
      };
    });
  }

  private assertReplacement(value: string): void {
    if (!/^anon-marketplace-[0-9a-f-]{36}$/.test(value)) {
      throw new BadRequestException(
        'Invalid marketplace anonymization replacement id',
      );
    }
  }
}
