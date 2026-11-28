import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingReportStatus,
  ListingStatus,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateListingReportDto,
  ReviewListingReportDto,
} from './dto/listing-report.dto';

@Injectable()
export class ListingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    reporterId: string,
    listingId: string,
    input: CreateListingReportDto,
  ) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.APPROVED,
      },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId === reporterId) {
      throw new ForbiddenException(
        'You cannot report your own listing',
      );
    }

    const duplicate = await this.prisma.listingReport.findUnique({
      where: {
        listingId_reporterId: {
          listingId,
          reporterId,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'You already reported this listing',
      );
    }

    const since = new Date(Date.now() - 60 * 60_000);
    const recent = await this.prisma.listingReport.count({
      where: {
        reporterId,
        createdAt: { gte: since },
      },
    });

    if (recent >= 10) {
      throw new HttpException(
        'Trop de signalements envoyés. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.listingReport.create({
      data: {
        listingId,
        reporterId,
        reason: input.reason,
        details: input.details?.trim() || null,
      },
      select: {
        id: true,
        listingId: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });
  }

  findForModeration(
    status: ListingReportStatus = ListingReportStatus.OPEN,
  ) {
    return this.prisma.listingReport.findMany({
      where: { status },
      include: {
        listing: {
          select: {
            id: true,
            ownerId: true,
            title: true,
            description: true,
            status: true,
            availabilityStatus: true,
            category: true,
            city: true,
            condition: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async review(
    id: string,
    reviewerId: string,
    input: ReviewListingReportDto,
  ) {
    const report = await this.prisma.listingReport.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            status: true,
            availabilityStatus: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Listing report not found');
    }

    if (input.status === ListingReportStatus.ACTIONED) {
      if (report.listing.availabilityStatus !== 'AVAILABLE') {
        throw new ConflictException(
          'A reserved or completed listing cannot be removed through report moderation',
        );
      }

      return this.prisma.$transaction(async (tx) => {
        if (report.listing.status === ListingStatus.APPROVED) {
          await tx.listing.update({
            where: { id: report.listingId },
            data: {
              status: ListingStatus.REJECTED,
              moderationReason:
                `Retirée après signalement: ${report.reason}`,
            },
          });
        }

        return tx.listingReport.update({
          where: { id },
          data: {
            status: ListingReportStatus.ACTIONED,
            reviewerId,
            reviewedAt: new Date(),
          },
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        });
      });
    }

    return this.prisma.listingReport.update({
      where: { id },
      data: {
        status: input.status,
        reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }
}
