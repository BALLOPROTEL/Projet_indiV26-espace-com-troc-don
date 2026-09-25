import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    ownerId: string,
    input: CreateListingDto,
  ): Promise<Listing> {
    return this.prisma.listing.create({
      data: {
        ownerId,
        title: input.title,
        description: input.description,
        operationType: input.operationType,
        status: ListingStatus.PENDING,
      },
    });
  }

  findPublic(): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: {
        status: ListingStatus.APPROVED,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPublicById(id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id,
        status: ListingStatus.APPROVED,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  findMine(ownerId: string): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateOwned(
    id: string,
    ownerId: string,
    input: UpdateListingDto,
  ): Promise<Listing> {
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.operationType === undefined
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

    return this.prisma.listing.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        operationType: input.operationType,
        status: ListingStatus.PENDING,
        moderationReason: null,
      },
    });
  }

  findForModeration(
    status: ListingStatus = ListingStatus.PENDING,
  ): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: {
        status,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async approve(id: string): Promise<Listing> {
    await this.requirePendingListing(id);

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.APPROVED,
        moderationReason: null,
      },
    });
  }

  async reject(
    id: string,
    input: RejectListingDto,
  ): Promise<Listing> {
    await this.requirePendingListing(id);

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.REJECTED,
        moderationReason: input.reason,
      },
    });
  }

  private async requireListing(id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  private async requirePendingListing(
    id: string,
  ): Promise<Listing> {
    const listing = await this.requireListing(id);

    if (listing.status !== ListingStatus.PENDING) {
      throw new ConflictException(
        'Only a pending listing can be moderated',
      );
    }

    return listing;
  }
}
