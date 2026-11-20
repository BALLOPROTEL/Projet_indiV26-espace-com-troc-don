import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListingsService,
  type ListingView,
} from '../listings/listings.service';

export type FavoriteState = {
  listingId: string;
  favorited: boolean;
};

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
  ) {}

  async findMine(userId: string): Promise<ListingView[]> {
    const favorites = await this.prisma.listingFavorite.findMany({
      where: { userId },
      select: { listingId: true },
      orderBy: [
        { createdAt: 'desc' },
        { listingId: 'asc' },
      ],
    });

    return this.listings.findPublicByIds(
      favorites.map((favorite) => favorite.listingId),
    );
  }

  async state(
    userId: string,
    listingId: string,
  ): Promise<FavoriteState> {
    const favorite = await this.prisma.listingFavorite.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
      select: { listingId: true },
    });

    return {
      listingId,
      favorited: favorite !== null,
    };
  }

  async add(
    userId: string,
    listingId: string,
  ): Promise<FavoriteState> {
    // This is also the public visibility/security check: private, pending or
    // rejected listings must never become bookmarkable through this endpoint.
    await this.listings.findPublicById(listingId);

    await this.prisma.listingFavorite.upsert({
      where: {
        userId_listingId: { userId, listingId },
      },
      create: { userId, listingId },
      update: {},
    });

    return { listingId, favorited: true };
  }

  async remove(
    userId: string,
    listingId: string,
  ): Promise<FavoriteState> {
    await this.prisma.listingFavorite.deleteMany({
      where: { userId, listingId },
    });

    return { listingId, favorited: false };
  }
}
