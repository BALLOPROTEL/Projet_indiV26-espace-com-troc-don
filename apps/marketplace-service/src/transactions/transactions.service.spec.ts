import { MarketplaceTransactionStatus } from '../../generated/prisma';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { MarketplaceEventPublisher } from '../events/event-publisher.service';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const transactionApi = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = {
    marketplaceTransaction: transactionApi,
  } as unknown as PrismaService;
  const catalog = {
    completeListing: jest.fn(),
  } as unknown as CatalogClientService;
  const rules = new MarketplaceRulesService();
  const events = {
    publish: jest.fn(),
  } as unknown as MarketplaceEventPublisher;
  const service = new TransactionsService(
    prisma,
    catalog,
    rules,
    events,
  );

  const baseTransaction = {
    id: 'tx-1',
    proposalId: 'proposal-1',
    targetListingId: 'target-1',
    offeredListingId: null,
    ownerId: 'owner-1',
    requesterId: 'requester-1',
    status: MarketplaceTransactionStatus.IN_PROGRESS,
    ownerConfirmedAt: null,
    requesterConfirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-06T19:00:00Z'),
    updatedAt: new Date('2026-10-06T19:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transactionApi.updateMany.mockResolvedValue({ count: 1 });
    (events.publish as jest.Mock).mockResolvedValue(true);
  });

  it('records one participant confirmation without completing', async () => {
    const ownerConfirmedAt = new Date();
    transactionApi.findUnique
      .mockResolvedValueOnce(baseTransaction)
      .mockResolvedValueOnce({ ...baseTransaction, ownerConfirmedAt });
    transactionApi.update.mockResolvedValue({
      ...baseTransaction,
      ownerConfirmedAt,
    });

    const result = await service.confirm('tx-1', 'owner-1');

    expect(transactionApi.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { ownerConfirmedAt: expect.any(Date) },
    });
    expect(transactionApi.updateMany).not.toHaveBeenCalled();
    expect(catalog.completeListing).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
    expect(result.status).toBe(MarketplaceTransactionStatus.IN_PROGRESS);
  });

  it('publishes completion only after winning the conditional transition', async () => {
    const ownerConfirmedAt = new Date();
    const requesterConfirmedAt = new Date();
    const before = { ...baseTransaction, ownerConfirmedAt };
    const confirmed = {
      ...before,
      requesterConfirmedAt,
      offeredListingId: 'offer-1',
    };
    const completed = {
      ...confirmed,
      status: MarketplaceTransactionStatus.COMPLETED,
      completedAt: new Date(),
    };

    transactionApi.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(confirmed)
      .mockResolvedValueOnce(completed);
    transactionApi.update.mockResolvedValue(confirmed);
    (catalog.completeListing as jest.Mock).mockResolvedValue({});

    const result = await service.confirm('tx-1', 'requester-1');

    expect(catalog.completeListing).toHaveBeenNthCalledWith(1, 'target-1');
    expect(catalog.completeListing).toHaveBeenNthCalledWith(2, 'offer-1');
    expect(transactionApi.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tx-1',
        status: MarketplaceTransactionStatus.IN_PROGRESS,
        ownerConfirmedAt: { not: null },
        requesterConfirmedAt: { not: null },
      },
      data: {
        status: MarketplaceTransactionStatus.COMPLETED,
        completedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe(MarketplaceTransactionStatus.COMPLETED);
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(
      'transaction.completed',
      expect.objectContaining({
        transactionId: 'tx-1',
        proposalId: 'proposal-1',
        targetListingId: 'target-1',
        offeredListingId: 'offer-1',
      }),
    );
  });

  it('does not publish when a concurrent request already completed it', async () => {
    const bothConfirmed = {
      ...baseTransaction,
      ownerConfirmedAt: new Date(),
      requesterConfirmedAt: new Date(),
    };
    const completed = {
      ...bothConfirmed,
      status: MarketplaceTransactionStatus.COMPLETED,
      completedAt: new Date(),
    };

    transactionApi.findUnique
      .mockResolvedValueOnce(bothConfirmed)
      .mockResolvedValueOnce(bothConfirmed)
      .mockResolvedValueOnce(completed);
    transactionApi.updateMany.mockResolvedValue({ count: 0 });
    (catalog.completeListing as jest.Mock).mockResolvedValue({});

    const result = await service.confirm('tx-1', 'owner-1');

    expect(result.status).toBe(MarketplaceTransactionStatus.COMPLETED);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('lists transactions where the actor is a participant', async () => {
    transactionApi.findMany.mockResolvedValue([]);

    await service.findMine('owner-1');

    expect(transactionApi.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ ownerId: 'owner-1' }, { requesterId: 'owner-1' }],
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});
