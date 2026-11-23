import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { PrismaService } from '../prisma/prisma.service';

export type CreateConversationMessageInput = {
  body?: unknown;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogClientService,
  ) {}

  async listMine(actorId: string) {
    await this.ensureLegacyConversations(actorId);

    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { ownerId: actorId },
          { requesterId: actorId },
        ],
      },
      include: {
        proposal: {
          select: {
            id: true,
            targetListingId: true,
            offeredListingId: true,
            type: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listMessages(
    conversationId: string,
    actorId: string,
    before?: string,
    limit?: string,
  ) {
    await this.requireParticipant(conversationId, actorId);

    const take = this.pageSize(limit);
    const beforeDate = this.beforeDate(before);

    return this.prisma.conversationMessage.findMany({
      where: {
        conversationId,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take,
    });
  }

  async sendMessage(
    conversationId: string,
    actorId: string,
    input: CreateConversationMessageInput,
  ) {
    await this.requireParticipant(conversationId, actorId);
    await this.assertWithinMessageRateLimit(actorId);

    const body = this.messageBody(input.body);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          conversationId,
          senderId: actorId,
          body,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: now },
      });

      return message;
    });
  }

  async markRead(conversationId: string, actorId: string) {
    await this.requireParticipant(conversationId, actorId);

    const result = await this.prisma.conversationMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: actorId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  private async ensureLegacyConversations(
    actorId: string,
  ): Promise<void> {
    const ownedListingIds =
      await this.catalog.getOwnerListingIds(actorId);
    const owned = new Set(ownedListingIds);

    const proposals = await this.prisma.proposal.findMany({
      where: {
        OR: [
          { requesterId: actorId },
          ...(ownedListingIds.length > 0
            ? [{
                targetListingId: {
                  in: ownedListingIds,
                },
              }]
            : []),
        ],
      },
      select: {
        id: true,
        targetListingId: true,
        requesterId: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (proposals.length === 0) {
      return;
    }

    const existing =
      await this.prisma.conversation.findMany({
        where: {
          proposalId: {
            in: proposals.map((proposal) => proposal.id),
          },
        },
        select: { proposalId: true },
      });
    const existingIds = new Set(
      existing.map((conversation) => conversation.proposalId),
    );

    for (const proposal of proposals) {
      if (existingIds.has(proposal.id)) {
        continue;
      }

      let ownerId: string;
      if (owned.has(proposal.targetListingId)) {
        ownerId = actorId;
      } else {
        try {
          ownerId = (
            await this.catalog.getListing(
              proposal.targetListingId,
            )
          ).ownerId;
        } catch {
          // Historical listing no longer resolvable: do not fabricate
          // conversation ownership.
          continue;
        }
      }

      await this.prisma.conversation.upsert({
        where: { proposalId: proposal.id },
        update: {},
        create: {
          proposalId: proposal.id,
          ownerId,
          requesterId: proposal.requesterId,
          createdAt: proposal.createdAt,
          updatedAt: proposal.updatedAt,
          messages: proposal.message
            ? {
                create: {
                  senderId: proposal.requesterId,
                  body: proposal.message,
                  createdAt: proposal.createdAt,
                },
              }
            : undefined,
        },
      });
    }
  }

  private async requireParticipant(
    conversationId: string,
    actorId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { ownerId: actorId },
          { requesterId: actorId },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        requesterId: true,
      },
    });

    if (!conversation) {
      // Deliberately hide whether a private conversation exists.
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private async assertWithinMessageRateLimit(
    actorId: string,
  ): Promise<void> {
    const createdSince = new Date(Date.now() - 60_000);
    const recent = await this.prisma.conversationMessage.count({
      where: {
        senderId: actorId,
        createdAt: { gte: createdSince },
      },
    });

    if (recent >= 20) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Trop de messages envoyés. Réessayez dans une minute.',
          retryAfterSeconds: 60,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private messageBody(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('body must be a string');
    }

    const body = value.trim();

    if (body.length === 0) {
      throw new BadRequestException('body must not be empty');
    }

    if (body.length > 1000) {
      throw new BadRequestException(
        'body must be at most 1000 characters',
      );
    }

    return body;
  }

  private pageSize(value?: string): number {
    if (value === undefined) {
      return 50;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 50',
      );
    }

    return parsed;
  }

  private beforeDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'before must be a valid ISO date',
      );
    }

    return date;
  }
}
