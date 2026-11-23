import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ListingReportReason,
  ListingReportStatus,
  ListingStatus,
} from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { ListingReportsService } from './listing-reports.service';

describe('ListingReportsService', () => {
  const tx = {
    listing: { update: jest.fn() },
    listingReport: { update: jest.fn() },
  };
  const prisma = {
    listing: {
      findFirst: jest.fn(),
    },
    listingReport: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
  const service = new ListingReportsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects self-reporting', async () => {
    (prisma.listing.findFirst as jest.Mock).mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
    });

    await expect(
      service.create('user-1', 'listing-1', {
        reason: ListingReportReason.OTHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a duplicate report by the same account', async () => {
    (prisma.listing.findFirst as jest.Mock).mockResolvedValue({
      id: 'listing-1',
      ownerId: 'owner-1',
    });
    (prisma.listingReport.findUnique as jest.Mock).mockResolvedValue({
      id: 'report-existing',
    });

    await expect(
      service.create('user-1', 'listing-1', {
        reason: ListingReportReason.SCAM,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a report against an approved third-party listing', async () => {
    (prisma.listing.findFirst as jest.Mock).mockResolvedValue({
      id: 'listing-1',
      ownerId: 'owner-1',
    });
    (prisma.listingReport.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.listingReport.count as jest.Mock).mockResolvedValue(0);
    (prisma.listingReport.create as jest.Mock).mockResolvedValue({
      id: 'report-1',
    });

    await service.create('user-1', 'listing-1', {
      reason: ListingReportReason.MISLEADING,
      details: 'La description semble trompeuse.',
    });

    expect(prisma.listingReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          listingId: 'listing-1',
          reporterId: 'user-1',
          reason: ListingReportReason.MISLEADING,
          details: 'La description semble trompeuse.',
        },
      }),
    );
  });

  it('ACTIONED hides an approved listing and records reviewer identity', async () => {
    (prisma.listingReport.findUnique as jest.Mock).mockResolvedValue({
      id: 'report-1',
      listingId: 'listing-1',
      reason: ListingReportReason.PROHIBITED,
      listing: {
        id: 'listing-1',
        status: ListingStatus.APPROVED,
      },
    });
    tx.listing.update.mockResolvedValue({ id: 'listing-1' });
    tx.listingReport.update.mockResolvedValue({
      id: 'report-1',
      status: ListingReportStatus.ACTIONED,
    });

    await service.review(
      'report-1',
      'moderator-1',
      { status: ListingReportStatus.ACTIONED },
    );

    expect(tx.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: {
        status: ListingStatus.REJECTED,
        moderationReason:
          'Retirée après signalement: PROHIBITED',
      },
    });
    expect(tx.listingReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ListingReportStatus.ACTIONED,
          reviewerId: 'moderator-1',
          reviewedAt: expect.any(Date),
        }),
      }),
    );
  });
});
