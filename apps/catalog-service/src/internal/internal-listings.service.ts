import { Injectable, NotFoundException } from '@nestjs/common';
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
}
