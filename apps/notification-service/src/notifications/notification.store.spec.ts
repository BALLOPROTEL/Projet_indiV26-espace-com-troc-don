import type { MarketplaceEventEnvelope } from './event-contract';
import {
  NotificationStore,
  notificationRecipients,
} from './notification.store';
import { NotificationPrismaService } from '../prisma/prisma.service';

type Row = {
  eventId: string;
  event: MarketplaceEventEnvelope;
  recipientIds: string[];
  receivedAt: Date;
};

function fakeSharedDatabase() {
  const rows = new Map<string, Row>();
  const client = {
    checkReady: jest.fn().mockResolvedValue(undefined),
    notificationEvent: {
      createMany: jest.fn().mockImplementation(async ({
        data,
      }: {
        data: Array<{
          eventId: string;
          event: MarketplaceEventEnvelope;
          recipientIds: string[];
        }>;
      }) => {
        const item = data[0];
        if (rows.has(item.eventId)) return { count: 0 };
        rows.set(item.eventId, {
          ...item,
          receivedAt: new Date(),
        });
        return { count: 1 };
      }),
      findMany: jest.fn().mockImplementation(async (args: {
        where?: { recipientIds?: { has?: string } };
      }) => {
        const userId = args?.where?.recipientIds?.has;
        return [...rows.values()]
          .filter((row) => !userId || row.recipientIds.includes(userId))
          .reverse()
          .slice(0, 50);
      }),
    },
  };
  return {
    client: client as unknown as NotificationPrismaService,
    rows,
  };
}

function event(eventId: string): MarketplaceEventEnvelope {
  return {
    eventId,
    type: 'transaction.completed',
    version: 1,
    occurredAt: '2026-10-07T17:01:00.000Z',
    source: 'marketplace-service',
    data: {
      transactionId: 'tx-1',
      proposalId: 'proposal-1',
      targetListingId: 'target-1',
      offeredListingId: null,
      ownerId: 'owner-1',
      requesterId: 'requester-1',
    },
  };
}

describe('NotificationStore durable PostgreSQL inbox', () => {
  it('derives recipients only from validated marketplace actors', () => {
    expect(notificationRecipients(event('tx'))).toEqual([
      'owner-1',
      'requester-1',
    ]);
    expect(notificationRecipients({
      eventId: 'created',
      type: 'proposal.created',
      version: 1,
      occurredAt: '2026-10-07T17:01:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'p',
        targetListingId: 'l',
        requesterId: 'requester-1',
        ownerId: 'owner-1',
        proposalType: 'DONATION_REQUEST',
        offeredListingId: null,
      },
    })).toEqual(['owner-1']);
  });

  it('persists newest-first and returns a defensive JSON copy', async () => {
    const db = fakeSharedDatabase();
    const store = new NotificationStore(db.client);
    const first = event('one');
    const second = event('two');
    expect(await store.record(first)).toBe(true);
    expect(await store.record(second)).toBe(true);
    const items = await store.recent();
    expect(items.map((item) => item.event.eventId)).toEqual(['two', 'one']);
    if (items[0].event.type !== 'transaction.completed') {
      throw new Error('bad test setup');
    }
    items[0].event.data.transactionId = 'mutated';
    const returned = (await store.recent())[0].event;
    if (returned.type !== 'transaction.completed') {
      throw new Error('bad test setup');
    }
    expect(returned.data.transactionId).toBe('tx-1');
  });

  it('filters the personal inbox by recipient id', async () => {
    const db = fakeSharedDatabase();
    const store = new NotificationStore(db.client);
    await store.record(event('visible'));
    await store.record({
      eventId: 'other',
      type: 'proposal.rejected',
      version: 1,
      occurredAt: '2026-10-07T17:02:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'p2',
        targetListingId: 'l2',
        requesterId: 'someone-else',
        ownerId: 'owner-2',
      },
    });

    const mine = await store.recentForUser('requester-1');
    expect(mine.map((item) => item.event.eventId)).toEqual(['visible']);
  });

  it('deduplicates across replicas using the shared unique key', async () => {
    const db = fakeSharedDatabase();
    const replicaA = new NotificationStore(db.client);
    const replicaB = new NotificationStore(db.client);
    const envelope = event('original-id');
    const [one, two] = await Promise.all([
      replicaA.record(envelope),
      replicaB.record(envelope),
    ]);
    expect([one, two].sort()).toEqual([false, true]);
  });

  it('does not silently acknowledge database errors', async () => {
    const db = fakeSharedDatabase();
    const store = new NotificationStore(db.client);
    jest
      .spyOn(db.client.notificationEvent, 'createMany')
      .mockRejectedValueOnce(new Error('PostgreSQL unavailable'));
    await expect(store.record(event('uncommitted')))
      .rejects.toThrow('PostgreSQL unavailable');
    expect(db.rows.has('uncommitted')).toBe(false);
  });
});
