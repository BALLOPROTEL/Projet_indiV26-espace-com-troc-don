import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
  MarketplaceTransactionStatus,
  ProposalStatus,
  ProposalType,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LOT 9B-A marketplace PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const actorPrefix = 'lot9b-a-integration-';

  async function cleanup(): Promise<void> {
    await prisma.marketplaceTransaction.deleteMany({
      where: {
        OR: [
          {
            ownerId: {
              startsWith: actorPrefix,
            },
          },
          {
            requesterId: {
              startsWith: actorPrefix,
            },
          },
        ],
      },
    });

    await prisma.proposal.deleteMany({
      where: {
        requesterId: {
          startsWith: actorPrefix,
        },
      },
    });

    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: actorPrefix,
        },
      },
    });
  }

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('persists images, trade wishes, proposal and transaction relations', async () => {
    const ownerId = `${actorPrefix}owner`;
    const requesterId = `${actorPrefix}requester`;

    const target = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Console rétro',
        description:
          'Console rétro complète avec câbles et manette, disponible pour un échange.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
        images: {
          create: Array.from({ length: 5 }, (_, index) => ({
            objectKey: `lot9b/target/image-${index + 1}.webp`,
            mimeType: 'image/webp',
            sizeBytes: 1000 + index,
            position: index,
          })),
        },
        tradeWishes: {
          create: [
            'Nintendo Switch',
            'Steam Deck',
            'Tablette',
            'PC portable',
            'Écran gaming',
          ].map((label, index) => ({
            label,
            position: index,
          })),
        },
      },
      include: {
        images: true,
        tradeWishes: true,
      },
    });

    const offered = await prisma.listing.create({
      data: {
        ownerId: requesterId,
        title: 'Nintendo Switch Lite',
        description:
          'Nintendo Switch Lite fonctionnelle proposée comme contrepartie de troc.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
      },
    });

    expect(target.availabilityStatus).toBe(
      ListingAvailabilityStatus.AVAILABLE,
    );
    expect(target.images).toHaveLength(5);
    expect(target.tradeWishes).toHaveLength(5);

    const proposal = await prisma.proposal.create({
      data: {
        targetListingId: target.id,
        requesterId,
        type: ProposalType.TRADE_OFFER,
        offeredListingId: offered.id,
        message: 'Je propose ma Switch Lite contre votre console.',
      },
    });

    expect(proposal.status).toBe(ProposalStatus.PENDING);

    const transaction =
      await prisma.marketplaceTransaction.create({
        data: {
          proposalId: proposal.id,
          targetListingId: target.id,
          offeredListingId: offered.id,
          ownerId,
          requesterId,
        },
      });

    expect(transaction.status).toBe(
      MarketplaceTransactionStatus.IN_PROGRESS,
    );

    const persisted = await prisma.proposal.findUnique({
      where: {
        id: proposal.id,
      },
      include: {
        targetListing: {
          include: {
            images: {
              orderBy: {
                position: 'asc',
              },
            },
            tradeWishes: {
              orderBy: {
                position: 'asc',
              },
            },
          },
        },
        offeredListing: true,
        transaction: true,
      },
    });

    expect(persisted?.targetListing.images).toHaveLength(5);
    expect(persisted?.targetListing.tradeWishes).toHaveLength(5);
    expect(persisted?.offeredListing?.id).toBe(offered.id);
    expect(persisted?.transaction?.proposalId).toBe(proposal.id);
  });
});
