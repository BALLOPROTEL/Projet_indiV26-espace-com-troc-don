import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingAvailabilityStatus,
  ListingStatus,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InternalListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        operationType: true,
        status: true,
        availabilityStatus: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async reserve(id: string) {
    const result = await this.prisma.listing.updateMany({
      where: {
        id,
        status: ListingStatus.APPROVED,
        availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
      },
      data: {
        availabilityStatus: ListingAvailabilityStatus.RESERVED,
      },
    });

    if (result.count !== 1) {
      await this.getSnapshot(id);
      throw new ConflictException('Listing is not available for reservation');
    }

    return this.getSnapshot(id);
  }

  async complete(id: string) {
    const current = await this.getSnapshot(id);

    if (
      current.availabilityStatus === ListingAvailabilityStatus.COMPLETED
    ) {
      return current;
    }

    if (current.availabilityStatus !== ListingAvailabilityStatus.RESERVED) {
      throw new ConflictException('Listing is not reserved');
    }

    await this.prisma.listing.update({
      where: { id },
      data: {
        availabilityStatus: ListingAvailabilityStatus.COMPLETED,
      },
    });

    return this.getSnapshot(id);
  }

  async release(id: string) {
    const current = await this.getSnapshot(id);

    if (
      current.availabilityStatus === ListingAvailabilityStatus.AVAILABLE
    ) {
      return current;
    }

    if (current.availabilityStatus !== ListingAvailabilityStatus.RESERVED) {
      throw new ConflictException('Listing cannot be released');
    }

    await this.prisma.listing.update({
      where: { id },
      data: {
        availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
      },
    });

    return this.getSnapshot(id);
  }
}
