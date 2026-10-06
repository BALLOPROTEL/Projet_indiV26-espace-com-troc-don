import { BadRequestException } from '@nestjs/common';
import { ProposalType } from '../../generated/prisma';
import { CatalogClientService } from '../catalog/catalog-client.service';
import {
  CatalogListingSnapshot,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '../catalog/catalog-contract';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';

describe('ProposalsService', () => {
  const proposalApi = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = { proposal: proposalApi } as unknown as PrismaService;
  const catalog = { getListing: jest.fn() } as unknown as CatalogClientService;
  const rules = new MarketplaceRulesService();
  const service = new ProposalsService(prisma, catalog, rules);

  const listing = (
    overrides: Partial<CatalogListingSnapshot> = {},
  ): CatalogListingSnapshot => ({
    id: 'target-1',
    ownerId: 'owner-1',
    operationType: ListingOperationType.DONATION,
    status: ListingStatus.APPROVED,
    availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    proposalApi.create.mockImplementation(async ({ data }) => ({
      id: 'proposal-1',
      ...data,
    }));
  });

  it('creates a donation request after Catalog validation', async () => {
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    const result = await service.create('requester-1', {
      targetListingId: 'target-1',
      type: ProposalType.DONATION_REQUEST,
      message: ' Je suis intéressé. ',
    });

    expect(catalog.getListing).toHaveBeenCalledWith('target-1');
    expect(proposalApi.create).toHaveBeenCalledWith({
      data: {
        targetListingId: 'target-1',
        requesterId: 'requester-1',
        type: ProposalType.DONATION_REQUEST,
        offeredListingId: null,
        message: 'Je suis intéressé.',
      },
    });
    expect(result.id).toBe('proposal-1');
  });

  it('rejects an offered listing on donation requests', async () => {
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    await expect(
      service.create('requester-1', {
        targetListingId: 'target-1',
        type: ProposalType.DONATION_REQUEST,
        offeredListingId: 'offer-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a trade offer only with a valid requester listing', async () => {
    (catalog.getListing as jest.Mock)
      .mockResolvedValueOnce(
        listing({ operationType: ListingOperationType.TRADE }),
      )
      .mockResolvedValueOnce(
        listing({
          id: 'offer-1',
          ownerId: 'requester-1',
          operationType: ListingOperationType.TRADE,
        }),
      );

    await service.create('requester-1', {
      targetListingId: 'target-1',
      offeredListingId: 'offer-1',
      type: ProposalType.TRADE_OFFER,
    });

    expect(catalog.getListing).toHaveBeenNthCalledWith(1, 'target-1');
    expect(catalog.getListing).toHaveBeenNthCalledWith(2, 'offer-1');
    expect(proposalApi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: ProposalType.TRADE_OFFER,
        offeredListingId: 'offer-1',
      }),
    });
  });

  it('rejects an invalid proposal type before persistence', async () => {
    await expect(
      service.create('requester-1', {
        targetListingId: 'target-1',
        type: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(catalog.getListing).not.toHaveBeenCalled();
    expect(proposalApi.create).not.toHaveBeenCalled();
  });

  it('lists proposals created by the authenticated requester', async () => {
    proposalApi.findMany.mockResolvedValue([]);

    await service.findMine('requester-1');

    expect(proposalApi.findMany).toHaveBeenCalledWith({
      where: { requesterId: 'requester-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
