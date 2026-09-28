import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { ListingsService } from '../src/listings/listings.service';
import { MarketplaceRulesService } from '../src/marketplace/marketplace-rules.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ListingsService PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const service = new ListingsService(
    prisma,
    new MarketplaceRulesService(),
  );
  const ownerPrefix = 'lot4-integration-';

  beforeEach(async () => {
    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: ownerPrefix,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: ownerPrefix,
        },
      },
    });
    await prisma.$disconnect();
  });

  it('persists a new listing as PENDING and returns it to its owner', async () => {
    const ownerId = `${ownerPrefix}user-1`;

    const created = await service.create(ownerId, {
      title: 'Lot de comics',
      description:
        'Lot de comics en très bon état proposé pour un échange.',
      operationType: ListingOperationType.TRADE,
      tradeWishes: [
        'Console',
        'Tablette',
        'Écran',
        'Clavier',
        'Casque',
      ],
    });

    expect(created.status).toBe(ListingStatus.PENDING);
    expect(created.availabilityStatus).toBe(
      ListingAvailabilityStatus.AVAILABLE,
    );
    expect(created.ownerId).toBe(ownerId);

    const mine = await service.findMine(ownerId);

    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe(created.id);
  });

  it('exposes a listing publicly only after approval', async () => {
    const ownerId = `${ownerPrefix}user-2`;

    const created = await service.create(ownerId, {
      title: 'DVD à donner',
      description:
        'DVD en bon état à donner à un autre membre de la communauté.',
      operationType: ListingOperationType.DONATION,
    });

    const beforeApproval = await service.findPublic();
    expect(beforeApproval.some((listing) => listing.id === created.id)).toBe(
      false,
    );

    await prisma.listingImage.createMany({
      data: Array.from({ length: 5 }, (_, position) => ({
        listingId: created.id,
        objectKey: `integration/${created.id}/${position}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 128,
        position,
      })),
    });

    const approved = await service.approve(created.id);
    expect(approved.status).toBe(ListingStatus.APPROVED);

    const afterApproval = await service.findPublic();
    expect(afterApproval.some((listing) => listing.id === created.id)).toBe(
      true,
    );
  });

  it('stores a rejection reason and keeps the listing private', async () => {
    const ownerId = `${ownerPrefix}user-3`;

    const created = await service.create(ownerId, {
      title: 'Affiche de film',
      description:
        'Affiche de film proposée en donation après vérification de son état.',
      operationType: ListingOperationType.DONATION,
    });

    const rejected = await service.reject(created.id, {
      reason: 'Merci de préciser les dimensions de l’affiche.',
    });

    expect(rejected.status).toBe(ListingStatus.REJECTED);
    expect(rejected.moderationReason).toBe(
      'Merci de préciser les dimensions de l’affiche.',
    );

    const publiclyVisible = await service.findPublic();
    expect(
      publiclyVisible.some((listing) => listing.id === created.id),
    ).toBe(false);
  });
});
