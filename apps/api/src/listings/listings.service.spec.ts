import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const listingApi = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    listing: listingApi,
  } as unknown as PrismaService;

  const service = new ListingsService(prisma);

  const pendingListing: Listing = {
    id: 'listing-1',
    ownerId: 'owner-1',
    title: 'Lot de romans',
    description: 'Un lot de romans fantastiques en bon état.',
    operationType: ListingOperationType.TRADE,
    status: ListingStatus.PENDING,
    moderationReason: null,
    createdAt: new Date('2026-09-25T12:00:00Z'),
    updatedAt: new Date('2026-09-25T12:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates listings as PENDING for the authenticated owner', async () => {
    listingApi.create.mockResolvedValue(pendingListing);

    await service.create('owner-1', {
      title: pendingListing.title,
      description: pendingListing.description,
      operationType: ListingOperationType.TRADE,
    });

    expect(listingApi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'owner-1',
        status: ListingStatus.PENDING,
      }),
    });
  });

  it('exposes only APPROVED listings publicly', async () => {
    listingApi.findMany.mockResolvedValue([]);

    await service.findPublic();

    expect(listingApi.findMany).toHaveBeenCalledWith({
      where: { status: ListingStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns only the authenticated owner listings', async () => {
    listingApi.findMany.mockResolvedValue([pendingListing]);

    const result = await service.findMine('owner-1');

    expect(result).toEqual([pendingListing]);
    expect(listingApi.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns PENDING listings by default for moderation', async () => {
    listingApi.findMany.mockResolvedValue([pendingListing]);

    const result = await service.findForModeration();

    expect(result).toEqual([pendingListing]);
    expect(listingApi.findMany).toHaveBeenCalledWith({
      where: { status: ListingStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('supports an explicit moderation status filter', async () => {
    listingApi.findMany.mockResolvedValue([]);

    await service.findForModeration(ListingStatus.REJECTED);

    expect(listingApi.findMany).toHaveBeenCalledWith({
      where: { status: ListingStatus.REJECTED },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('rejects an empty owner update', async () => {
    await expect(
      service.updateOwned('listing-1', 'owner-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks updates from another owner', async () => {
    listingApi.findUnique.mockResolvedValue(pendingListing);

    await expect(
      service.updateOwned('listing-1', 'other-owner', {
        title: 'Titre modifié',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks modifications after approval', async () => {
    listingApi.findUnique.mockResolvedValue({
      ...pendingListing,
      status: ListingStatus.APPROVED,
    });

    await expect(
      service.updateOwned('listing-1', 'owner-1', {
        title: 'Titre modifié',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a pending listing owned by the current user', async () => {
    listingApi.findUnique.mockResolvedValue(pendingListing);
    listingApi.update.mockResolvedValue({
      ...pendingListing,
      title: 'Titre modifié',
    });

    const result = await service.updateOwned(
      'listing-1',
      'owner-1',
      {
        title: 'Titre modifié',
      },
    );

    expect(result.title).toBe('Titre modifié');
    expect(listingApi.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: {
        title: 'Titre modifié',
        description: undefined,
        operationType: undefined,
        status: ListingStatus.PENDING,
        moderationReason: null,
      },
    });
  });

  it('resubmits a rejected listing as PENDING after owner edit', async () => {
    listingApi.findUnique.mockResolvedValue({
      ...pendingListing,
      status: ListingStatus.REJECTED,
      moderationReason: 'Description insuffisante',
    });
    listingApi.update.mockResolvedValue(pendingListing);

    await service.updateOwned('listing-1', 'owner-1', {
      description:
        'Description corrigée et suffisamment détaillée.',
    });

    expect(listingApi.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: expect.objectContaining({
        status: ListingStatus.PENDING,
        moderationReason: null,
      }),
    });
  });

  it('returns 404 when the listing does not exist', async () => {
    listingApi.findUnique.mockResolvedValue(null);

    await expect(
      service.approve('missing-listing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approves only a PENDING listing', async () => {
    listingApi.findUnique.mockResolvedValue(pendingListing);
    listingApi.update.mockResolvedValue({
      ...pendingListing,
      status: ListingStatus.APPROVED,
    });

    await service.approve('listing-1');

    expect(listingApi.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: {
        status: ListingStatus.APPROVED,
        moderationReason: null,
      },
    });
  });

  it('rejects moderation when the listing is no longer PENDING', async () => {
    listingApi.findUnique.mockResolvedValue({
      ...pendingListing,
      status: ListingStatus.APPROVED,
    });

    await expect(
      service.reject('listing-1', {
        reason: 'Tentative tardive',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores the moderation reason when rejecting', async () => {
    listingApi.findUnique.mockResolvedValue(pendingListing);
    listingApi.update.mockResolvedValue({
      ...pendingListing,
      status: ListingStatus.REJECTED,
      moderationReason: 'Description insuffisante',
    });

    await service.reject('listing-1', {
      reason: 'Description insuffisante',
    });

    expect(listingApi.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: {
        status: ListingStatus.REJECTED,
        moderationReason: 'Description insuffisante',
      },
    });
  });
});
