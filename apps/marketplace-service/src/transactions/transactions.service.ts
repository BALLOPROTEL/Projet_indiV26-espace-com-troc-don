import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceTransactionStatus } from '../../generated/prisma';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogClientService,
    private readonly rules: MarketplaceRulesService,
  ) {}

  findMine(actorId: string) {
    return this.prisma.marketplaceTransaction.findMany({
      where: {
        OR: [{ ownerId: actorId }, { requesterId: actorId }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirm(id: string, actorId: string) {
    let transaction = await this.prisma.marketplaceTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.rules.assertCanConfirmTransaction(transaction, actorId);

    const now = new Date();

    if (actorId === transaction.ownerId && !transaction.ownerConfirmedAt) {
      await this.prisma.marketplaceTransaction.update({
        where: { id },
        data: { ownerConfirmedAt: now },
      });
    }

    if (
      actorId === transaction.requesterId &&
      !transaction.requesterConfirmedAt
    ) {
      await this.prisma.marketplaceTransaction.update({
        where: { id },
        data: { requesterConfirmedAt: now },
      });
    }

    transaction = await this.prisma.marketplaceTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (
      transaction.status === MarketplaceTransactionStatus.IN_PROGRESS &&
      transaction.ownerConfirmedAt &&
      transaction.requesterConfirmedAt
    ) {
      await this.catalog.completeListing(transaction.targetListingId);

      if (transaction.offeredListingId) {
        await this.catalog.completeListing(transaction.offeredListingId);
      }

      transaction = await this.prisma.marketplaceTransaction.update({
        where: { id },
        data: {
          status: MarketplaceTransactionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    return transaction;
  }
}
