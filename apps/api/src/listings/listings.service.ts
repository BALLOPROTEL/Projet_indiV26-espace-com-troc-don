import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingImage,
  ListingStatus,
  ListingTradeWish,
} from '@prisma/client';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

type ListingWithAssets = Listing & {
  images: ListingImage[];
  tradeWishes: ListingTradeWish[];
};

export type ListingImageView = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  contentUrl: string;
};

export type ListingTradeWishView = {
  id: string;
  label: string;
  position: number;
};

export type ListingView = Listing & {
  images: ListingImageView[];
  tradeWishes: ListingTradeWishView[];
};

const assetInclude = {
  images: {
    orderBy: {
      position: 'asc' as const,
    },
  },
  tradeWishes: {
    orderBy: {
      position: 'asc' as const,
    },
  },
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaceRules: MarketplaceRulesService,
  ) {}

  async create(
    ownerId: string,
    input: CreateListingDto,
  ): Promise<ListingView> {
    const tradeWishes = this.marketplaceRules.validateTradeWishes(
      input.operationType,
      input.tradeWishes ?? [],
    );

    const listing = await this.prisma.listing.create({
      data: {
        ownerId,
        title: input.title,
        description: input.description,
        operationType: input.operationType,
        status: ListingStatus.PENDING,
        tradeWishes: {
          create: tradeWishes.map((label, position) => ({
            label,
            position,
          })),
        },
      },
      include: assetInclude,
    });

    return this.toView(listing);
  }

  async findPublic(): Promise<ListingView[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.APPROVED,
      },
      include: assetInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return listings.map((listing) => this.toView(listing));
  }

  async findPublicById(id: string): Promise<ListingView> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id,
        status: ListingStatus.APPROVED,
      },
      include: assetInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.toView(listing);
  }

  async findMine(ownerId: string): Promise<ListingView[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        ownerId,
      },
      include: assetInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return listings.map((listing) => this.toView(listing));
  }

  async updateOwned(
    id: string,
    ownerId: string,
    input: UpdateListingDto,
  ): Promise<ListingView> {
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.operationType === undefined &&
      input.tradeWishes === undefined
    ) {
      throw new BadRequestException(
        'At least one editable field is required',
      );
    }

    const listing = await this.requireListing(id);

    if (listing.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the listing owner may edit it',
      );
    }

    if (listing.status === ListingStatus.APPROVED) {
      throw new ConflictException(
        'An approved listing cannot be edited',
      );
    }

    const operationType =
      input.operationType ?? listing.operationType;
    const shouldReplaceWishes =
      input.tradeWishes !== undefined ||
      input.operationType !== undefined;
    const currentWishes = listing.tradeWishes.map(
      (wish) => wish.label,
    );
    const wishesForValidation =
      input.tradeWishes ??
      (operationType === 'DONATION' ? [] : currentWishes);
    const normalizedWishes = shouldReplaceWishes
      ? this.marketplaceRules.validateTradeWishes(
          operationType,
          wishesForValidation,
        )
      : currentWishes;

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        operationType: input.operationType,
        status: ListingStatus.PENDING,
        moderationReason: null,
        tradeWishes: shouldReplaceWishes
          ? {
              deleteMany: {},
              create: normalizedWishes.map(
                (label, position) => ({
                  label,
                  position,
                }),
              ),
            }
          : undefined,
      },
      include: assetInclude,
    });

    return this.toView(updated);
  }

  async findForModeration(
    status: ListingStatus = ListingStatus.PENDING,
  ): Promise<ListingView[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status,
      },
      include: assetInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });

    return listings.map((listing) => this.toView(listing));
  }

  async approve(id: string): Promise<ListingView> {
    const listing = await this.requirePendingListing(id);

    this.marketplaceRules.validatePublicationAssets(
      listing.operationType,
      listing.images.length,
      listing.tradeWishes.map((wish) => wish.label),
    );

    const claim = await this.prisma.listing.updateMany({
      where: {
        id,
        status: ListingStatus.PENDING,
        updatedAt: listing.updatedAt,
      },
      data: {
        status: ListingStatus.APPROVED,
        moderationReason: null,
      },
    });

    if (claim.count !== 1) {
      throw new ConflictException(
        'Listing changed while approval was being processed; retry',
      );
    }

    return this.toView(await this.requireListing(id));
  }

  async reject(
    id: string,
    input: RejectListingDto,
  ): Promise<ListingView> {
    await this.requirePendingListing(id);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.REJECTED,
        moderationReason: input.reason,
      },
      include: assetInclude,
    });

    return this.toView(updated);
  }

  private async requireListing(
    id: string,
  ): Promise<ListingWithAssets> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: assetInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  private async requirePendingListing(
    id: string,
  ): Promise<ListingWithAssets> {
    const listing = await this.requireListing(id);

    if (listing.status !== ListingStatus.PENDING) {
      throw new ConflictException(
        'Only a pending listing can be moderated',
      );
    }

    return listing;
  }

  private toView(listing: ListingWithAssets): ListingView {
    return {
      id: listing.id,
      ownerId: listing.ownerId,
      title: listing.title,
      description: listing.description,
      operationType: listing.operationType,
      status: listing.status,
      availabilityStatus: listing.availabilityStatus,
      moderationReason: listing.moderationReason,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      images: listing.images.map((image) => ({
        id: image.id,
        position: image.position,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        contentUrl:
          `/api/listings/${listing.id}/images/${image.id}/content`,
      })),
      tradeWishes: listing.tradeWishes.map((wish) => ({
        id: wish.id,
        label: wish.label,
        position: wish.position,
      })),
    };
  }
}
