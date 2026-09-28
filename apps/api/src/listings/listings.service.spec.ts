import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const listingApi = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    listing: listingApi,
  } as unknown as PrismaService;

  const rules = new MarketplaceRulesService();
  const service = new ListingsService(prisma, rules);

  const pendingListing: Listing = {
    id: 'listing-1',
    ownerId: 'owner-1',
    title: 'Lot de romans',
    description: 'Un lot de romans fantastiques en bon état.',
    operationType: ListingOperationType.TRADE,
    status: ListingStatus.PENDING,
    availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
    moderationReason: null,
    createdAt: new Date('2026-09-25T12:00:00Z'),
    updatedAt: new Date('2026-09-25T12:00:00Z'),
  };

  const wishes = [
    'Console',
    'Tablette',
    'Écran',
    'Clavier',
    'Casque',
  ];

  const richListing = (
    overrides: Record<string, unknown> = {},
  ) => ({
    ...pendingListing,
    images: Array.from({ length: 5 }, (_, position) => ({
      id: `image-${position}`,
      listingId: pendingListing.id,
      objectKey: `private/image-${position}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 100 + position,
      position,
      createdAt: new Date(),
    })),
    tradeWishes: wishes.map((label, position) => ({
      id: `wish-${position}`,
      listingId: pendingListing.id,
      label,
      position,
      createdAt: new Date(),
    })),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a TRADE listing with normalized wishes as PENDING', async () => {
    listingApi.create.mockResolvedValue(richListing());

    const result = await service.create('owner-1', {
      title: pendingListing.title,
      description: pendingListing.description,
      operationType: ListingOperationType.TRADE,
      tradeWishes: wishes,
    });

    expect(result.tradeWishes).toHaveLength(5);
    expect(listingApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'owner-1',
          status: ListingStatus.PENDING,
          tradeWishes: {
            create: wishes.map((label, position) => ({
              label,
              position,
            })),
          },
        }),
      }),
    );
  });

  it('rejects a TRADE listing with fewer than 5 distinct wishes', async () => {
    await expect(
      service.create('owner-1', {
        title: pendingListing.title,
        description: pendingListing.description,
        operationType: ListingOperationType.TRADE,
        tradeWishes: ['A', 'B', 'C', 'D'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(listingApi.create).not.toHaveBeenCalled();
  });

  it('creates a DONATION without trade wishes', async () => {
    listingApi.create.mockResolvedValue(
      richListing({
        operationType: ListingOperationType.DONATION,
        tradeWishes: [],
      }),
    );

    await service.create('owner-1', {
      title: 'Objet à donner',
      description: 'Objet encore utile donné sans contrepartie.',
      operationType: ListingOperationType.DONATION,
    });

    expect(listingApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeWishes: {
            create: [],
          },
        }),
      }),
    );
  });

  it('exposes enriched APPROVED listings without storage keys', async () => {
    listingApi.findMany.mockResolvedValue([
      richListing({
        status: ListingStatus.APPROVED,
      }),
    ]);

    const result = await service.findPublic();

    expect(result).toHaveLength(1);
    expect(result[0]?.images).toHaveLength(5);
    expect(result[0]?.tradeWishes).toHaveLength(5);
    expect(result[0]?.images[0]).not.toHaveProperty('objectKey');
    expect(result[0]?.images[0]?.contentUrl).toContain(
      '/api/listings/listing-1/images/image-0/content',
    );
    expect(listingApi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ListingStatus.APPROVED },
      }),
    );
  });

  it('returns one enriched APPROVED listing publicly by id', async () => {
    const approvedListing = richListing({
      status: ListingStatus.APPROVED,
    });
    listingApi.findFirst.mockResolvedValue(approvedListing);

    const result = await service.findPublicById('listing-1');

    expect(result.id).toBe('listing-1');
    expect(result.images).toHaveLength(5);
    expect(result.tradeWishes.map((wish) => wish.label)).toEqual(
      wishes,
    );
  });

  it('returns 404 for a listing that is not publicly approved', async () => {
    listingApi.findFirst.mockResolvedValue(null);

    await expect(
      service.findPublicById('listing-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only the authenticated owner listings with assets', async () => {
    listingApi.findMany.mockResolvedValue([richListing()]);

    const result = await service.findMine('owner-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.images).toHaveLength(5);
    expect(listingApi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'owner-1' },
      }),
    );
  });

  it('returns PENDING listings by default for moderation', async () => {
    listingApi.findMany.mockResolvedValue([richListing()]);

    const result = await service.findForModeration();

    expect(result).toHaveLength(1);
    expect(result[0]?.tradeWishes).toHaveLength(5);
    expect(listingApi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ListingStatus.PENDING },
      }),
    );
  });

  it('rejects an empty owner update', async () => {
    await expect(
      service.updateOwned('listing-1', 'owner-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks updates from another owner', async () => {
    listingApi.findUnique.mockResolvedValue(richListing());

    await expect(
      service.updateOwned('listing-1', 'other-owner', {
        title: 'Titre modifié',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks modifications after approval', async () => {
    listingApi.findUnique.mockResolvedValue(
      richListing({
        status: ListingStatus.APPROVED,
      }),
    );

    await expect(
      service.updateOwned('listing-1', 'owner-1', {
        title: 'Titre modifié',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates wishes and returns the listing to PENDING', async () => {
    listingApi.findUnique.mockResolvedValue(richListing());
    listingApi.update.mockResolvedValue(
      richListing({
        title: 'Titre modifié',
      }),
    );

    const result = await service.updateOwned(
      'listing-1',
      'owner-1',
      {
        title: 'Titre modifié',
        tradeWishes: wishes,
      },
    );

    expect(result.title).toBe('Titre modifié');
    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'listing-1' },
        data: expect.objectContaining({
          title: 'Titre modifié',
          status: ListingStatus.PENDING,
          moderationReason: null,
          tradeWishes: {
            deleteMany: {},
            create: wishes.map((label, position) => ({
              label,
              position,
            })),
          },
        }),
      }),
    );
  });

  it('clears trade wishes when switching to DONATION', async () => {
    listingApi.findUnique.mockResolvedValue(richListing());
    listingApi.update.mockResolvedValue(
      richListing({
        operationType: ListingOperationType.DONATION,
        tradeWishes: [],
      }),
    );

    await service.updateOwned('listing-1', 'owner-1', {
      operationType: ListingOperationType.DONATION,
      tradeWishes: [],
    });

    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operationType: ListingOperationType.DONATION,
          tradeWishes: {
            deleteMany: {},
            create: [],
          },
        }),
      }),
    );
  });

  it('resubmits a rejected listing as PENDING after owner edit', async () => {
    listingApi.findUnique.mockResolvedValue(
      richListing({
        status: ListingStatus.REJECTED,
        moderationReason: 'Description insuffisante',
      }),
    );
    listingApi.update.mockResolvedValue(richListing());

    await service.updateOwned('listing-1', 'owner-1', {
      description:
        'Description corrigée et suffisamment détaillée.',
    });

    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ListingStatus.PENDING,
          moderationReason: null,
        }),
      }),
    );
  });

  it('returns 404 when the listing does not exist', async () => {
    listingApi.findUnique.mockResolvedValue(null);

    await expect(
      service.approve('missing-listing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses approval when publication assets are incomplete', async () => {
    listingApi.findUnique.mockResolvedValue(
      richListing({
        images: [],
      }),
    );

    await expect(
      service.approve('listing-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(listingApi.update).not.toHaveBeenCalled();
  });

  it('approves a PENDING listing only when enriched assets are valid', async () => {
    listingApi.findUnique.mockResolvedValue(richListing());
    listingApi.update.mockResolvedValue(
      richListing({
        status: ListingStatus.APPROVED,
      }),
    );

    const result = await service.approve('listing-1');

    expect(result.status).toBe(ListingStatus.APPROVED);
    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'listing-1' },
        data: {
          status: ListingStatus.APPROVED,
          moderationReason: null,
        },
      }),
    );
  });

  it('rejects moderation when the listing is no longer PENDING', async () => {
    listingApi.findUnique.mockResolvedValue(
      richListing({
        status: ListingStatus.APPROVED,
      }),
    );

    await expect(
      service.reject('listing-1', {
        reason: 'Tentative tardive',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores the moderation reason when rejecting', async () => {
    listingApi.findUnique.mockResolvedValue(richListing());
    listingApi.update.mockResolvedValue(
      richListing({
        status: ListingStatus.REJECTED,
        moderationReason: 'Description insuffisante',
      }),
    );

    await service.reject('listing-1', {
      reason: 'Description insuffisante',
    });

    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ListingStatus.REJECTED,
          moderationReason: 'Description insuffisante',
        },
      }),
    );
  });
});
