import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ListingsService } from '../listings/listings.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  const listingFavorite = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
  const prisma = { listingFavorite } as unknown as PrismaService;
  const listings = {
    findPublicByIds: jest.fn(),
    findPublicById: jest.fn(),
  } as unknown as ListingsService;
  const service = new FavoritesService(prisma, listings);

  beforeEach(() => jest.clearAllMocks());

  it('returns only approved listing views in favorite order', async () => {
    listingFavorite.findMany.mockResolvedValue([
      { listingId: 'b' },
      { listingId: 'a' },
    ]);
    (listings.findPublicByIds as jest.Mock).mockResolvedValue([
      { id: 'b' },
      { id: 'a' },
    ]);

    await expect(service.findMine('user-1')).resolves.toEqual([
      { id: 'b' },
      { id: 'a' },
    ]);
    expect(listings.findPublicByIds).toHaveBeenCalledWith(['b', 'a']);
  });

  it('adds a visible listing idempotently', async () => {
    (listings.findPublicById as jest.Mock).mockResolvedValue({ id: 'a' });
    listingFavorite.upsert.mockResolvedValue({
      userId: 'user-1',
      listingId: 'a',
    });

    await expect(service.add('user-1', 'a')).resolves.toEqual({
      listingId: 'a',
      favorited: true,
    });
    expect(listingFavorite.upsert).toHaveBeenCalledWith({
      where: {
        userId_listingId: { userId: 'user-1', listingId: 'a' },
      },
      create: { userId: 'user-1', listingId: 'a' },
      update: {},
    });
  });

  it('does not favorite a private or missing listing', async () => {
    (listings.findPublicById as jest.Mock).mockRejectedValue(
      new NotFoundException('Listing not found'),
    );

    await expect(service.add('user-1', 'hidden')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(listingFavorite.upsert).not.toHaveBeenCalled();
  });

  it('removes a favorite idempotently', async () => {
    listingFavorite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('user-1', 'a')).resolves.toEqual({
      listingId: 'a',
      favorited: false,
    });
  });
});
