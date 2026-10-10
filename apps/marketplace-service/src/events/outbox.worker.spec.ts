import { MarketplaceOutboxWorker } from './outbox.worker';
import { MarketplaceEventPublisher } from './event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';

const row = () => ({
  eventId: 'delivery-stable-id',
  type: 'proposal.rejected',
  payload: {
    proposalId: 'proposal-1',
    targetListingId: 'target-1',
    requesterId: 'requester-1',
    ownerId: 'owner-1',
  },
  occurredAt: new Date('2026-10-10T10:00:00.000Z'),
  createdAt: new Date('2026-10-10T10:00:00.000Z'),
  publishedAt: null as Date | null,
  attempts: 0,
});

describe('MarketplaceOutboxWorker durable event retries', () => {
  it('preserves the same eventId after RabbitMQ outage and eventual recovery', async () => {
    const record = row();
    const findMany = jest.fn(async () => record.publishedAt ? [] : [record]);
    const updateMany = jest.fn(async ({ data }: {
      data: { attempts: { increment: number }; publishedAt?: Date };
    }) => {
      record.attempts += data.attempts.increment;
      if (data.publishedAt) record.publishedAt = data.publishedAt;
      return { count: 1 };
    });
    const prisma = {
      marketplaceOutboxEvent: { findMany, updateMany },
    } as unknown as PrismaService;
    const publishEnvelope = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const events = { publishEnvelope } as unknown as MarketplaceEventPublisher;
    const worker = new MarketplaceOutboxWorker(prisma, events);

    await worker.flush();
    expect(record.publishedAt).toBeNull();
    expect(record.attempts).toBe(1);

    await worker.flush();
    expect(record.publishedAt).toBeInstanceOf(Date);
    expect(record.attempts).toBe(2);
    expect(publishEnvelope).toHaveBeenCalledTimes(2);
    expect(publishEnvelope).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventId: 'delivery-stable-id',
      type: 'proposal.rejected',
      version: 1,
      source: 'marketplace-service',
    }));
    expect(publishEnvelope.mock.calls[0][0].eventId)
      .toBe(publishEnvelope.mock.calls[1][0].eventId);
    await worker.flush();
    expect(publishEnvelope).toHaveBeenCalledTimes(2);
  });

  it('does not mark the record published when persistence of delivery acknowledgement fails', async () => {
    const record = row();
    const prisma = {
      marketplaceOutboxEvent: {
        findMany: jest.fn(async () => [record]),
        updateMany: jest.fn().mockRejectedValueOnce(new Error('DB unavailable')),
      },
    } as unknown as PrismaService;
    const publishEnvelope = jest.fn().mockResolvedValue(true);
    const worker = new MarketplaceOutboxWorker(
      prisma, { publishEnvelope } as unknown as MarketplaceEventPublisher,
    );

    await expect(worker.flush()).rejects.toThrow('DB unavailable');
    expect(record.publishedAt).toBeNull();
    // On the next sweep the exact same ID can be published again; the
    // Notification PostgreSQL inbox rejects the duplicate atomically.
  });
});
