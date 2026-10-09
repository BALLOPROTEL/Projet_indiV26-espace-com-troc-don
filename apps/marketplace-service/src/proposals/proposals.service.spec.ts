import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProposalStatus, ProposalType } from '../../generated/prisma';
import { CatalogClientService } from '../catalog/catalog-client.service';
import {
  CatalogListingSnapshot,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '../catalog/catalog-contract';
import { MarketplaceEventPublisher } from '../events/event-publisher.service';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';

describe('ProposalsService', () => {
  const proposalApi = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const transactionApi = {
    create: jest.fn(),
  };
  const tx = {
    proposal: proposalApi,
    marketplaceTransaction: transactionApi,
  };
  const prisma = {
    proposal: proposalApi,
    $transaction: jest.fn(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as unknown as PrismaService;
  const catalog = {
    getListing: jest.fn(),
    getOwnerListingIds: jest.fn(),
    reserveListing: jest.fn(),
    releaseListing: jest.fn(),
  } as unknown as CatalogClientService;
  const rules = new MarketplaceRulesService();
  const events = {
    publish: jest.fn(),
  } as unknown as MarketplaceEventPublisher;
  const service = new ProposalsService(
    prisma,
    catalog,
    rules,
    events,
  );

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

  const proposal = (overrides: Record<string, unknown> = {}) => ({
    id: 'proposal-1',
    targetListingId: 'target-1',
    requesterId: 'requester-1',
    type: ProposalType.DONATION_REQUEST,
    offeredListingId: null,
    message: null,
    status: ProposalStatus.PENDING,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    proposalApi.create.mockImplementation(async ({ data }) => ({
      id: 'proposal-1',
      ...data,
    }));
    proposalApi.updateMany.mockResolvedValue({ count: 1 });
    transactionApi.create.mockImplementation(async ({ data }) => ({
      id: 'tx-1',
      ...data,
    }));
    (catalog.reserveListing as jest.Mock).mockResolvedValue({});
    (catalog.releaseListing as jest.Mock).mockResolvedValue({});
    (events.publish as jest.Mock).mockResolvedValue(true);
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
    expect(events.publish).toHaveBeenCalledWith(
      'proposal.created',
      expect.objectContaining({
        proposalId: 'proposal-1',
        targetListingId: 'target-1',
        requesterId: 'requester-1',
      }),
    );
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


  it('returns received proposals solely for target listing IDs owned by actor', async () => {
    (catalog.getOwnerListingIds as jest.Mock).mockResolvedValue(['item-a', 'item-b']);
    proposalApi.findMany.mockResolvedValue([]);

    await service.findReceived('owner-1');

    expect(catalog.getOwnerListingIds).toHaveBeenCalledWith('owner-1');
    expect(proposalApi.findMany).toHaveBeenCalledWith({
      where: { targetListingId: { in: ['item-a', 'item-b'] } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('never queries proposals when the actor owns no listings', async () => {
    (catalog.getOwnerListingIds as jest.Mock).mockResolvedValue([]);
    await expect(service.findReceived('owner-1')).resolves.toEqual([]);
    expect(proposalApi.findMany).not.toHaveBeenCalled();
  });

  it('rejects a pending proposal owned by actor without reserving Catalog', async () => {
    proposalApi.findUnique.mockResolvedValue(proposal());
    proposalApi.findUniqueOrThrow.mockResolvedValue(
      proposal({ status: ProposalStatus.REJECTED }),
    );
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    const result = await service.reject('proposal-1', 'owner-1');

    expect(result.status).toBe(ProposalStatus.REJECTED);
    expect(proposalApi.updateMany).toHaveBeenCalledWith({
      where: { id: 'proposal-1', status: ProposalStatus.PENDING },
      data: { status: ProposalStatus.REJECTED, resolvedAt: expect.any(Date) },
    });
    expect(catalog.reserveListing).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      'proposal.rejected',
      expect.objectContaining({
        proposalId: 'proposal-1',
        ownerId: 'owner-1',
        requesterId: 'requester-1',
      }),
    );
  });

  it('prevents non-owners from rejecting a proposal', async () => {
    proposalApi.findUnique.mockResolvedValue(proposal());
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    await expect(service.reject('proposal-1', 'stranger'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(proposalApi.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown proposal', async () => {
    proposalApi.findUnique.mockResolvedValue(null);
    await expect(service.reject('missing', 'owner-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 if another action already resolved the proposal', async () => {
    proposalApi.findUnique.mockResolvedValue(proposal());
    proposalApi.updateMany.mockResolvedValue({ count: 0 });
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());
    await expect(service.reject('proposal-1', 'owner-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('accepts a donation proposal and creates a transaction', async () => {
    proposalApi.findUnique.mockResolvedValue(proposal());
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    const result = await service.accept('proposal-1', 'owner-1');

    expect(catalog.reserveListing).toHaveBeenCalledWith('target-1');
    expect(transactionApi.create).toHaveBeenCalledWith({
      data: {
        proposalId: 'proposal-1',
        targetListingId: 'target-1',
        offeredListingId: null,
        ownerId: 'owner-1',
        requesterId: 'requester-1',
      },
    });
    expect(result.id).toBe('tx-1');
    expect(events.publish).toHaveBeenCalledWith(
      'proposal.accepted',
      expect.objectContaining({
        proposalId: 'proposal-1',
        transactionId: 'tx-1',
        ownerId: 'owner-1',
        requesterId: 'requester-1',
      }),
    );
  });

  it('prevents a non-owner from accepting a proposal', async () => {
    proposalApi.findUnique.mockResolvedValue(proposal());
    (catalog.getListing as jest.Mock).mockResolvedValue(listing());

    await expect(
      service.accept('proposal-1', 'someone-else'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(catalog.reserveListing).not.toHaveBeenCalled();
  });

  it('releases the target when trade counterpart reservation fails', async () => {
    proposalApi.findUnique.mockResolvedValue(
      proposal({
        type: ProposalType.TRADE_OFFER,
        offeredListingId: 'offer-1',
      }),
    );
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
    (catalog.reserveListing as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('reservation conflict'));

    await expect(
      service.accept('proposal-1', 'owner-1'),
    ).rejects.toThrow('reservation conflict');

    expect(catalog.releaseListing).toHaveBeenCalledWith('target-1');
  });
});
