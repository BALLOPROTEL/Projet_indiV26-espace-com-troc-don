import type { MarketplaceEventEnvelope } from './event-contract';
import { NotificationStore } from './notification.store';
import { NotificationPrismaService } from '../prisma/prisma.service';

function fakeSharedDatabase() {
  const rows = new Map<string, { eventId: string; event: MarketplaceEventEnvelope; receivedAt: Date }>();
  const client = {
    checkReady: jest.fn().mockResolvedValue(undefined),
    notificationEvent: {
      createMany: jest.fn().mockImplementation(async ({ data }: { data: { eventId: string; event: MarketplaceEventEnvelope }[] }) => {
        const item = data[0];
        if (rows.has(item.eventId)) return { count: 0 };
        rows.set(item.eventId, { ...item, receivedAt: new Date() });
        return { count: 1 };
      }),
      findMany: jest.fn().mockImplementation(async () =>
        [...rows.values()].reverse().slice(0, 50)),
    },
  };
  return { client: client as unknown as NotificationPrismaService, rows };
}

function event(eventId: string): MarketplaceEventEnvelope {
  return {
    eventId, type: 'transaction.completed', version: 1,
    occurredAt: '2026-10-07T17:01:00.000Z', source: 'marketplace-service',
    data: {
      transactionId: 'tx-1', proposalId: 'proposal-1',
      targetListingId: 'target-1', offeredListingId: null,
      ownerId: 'owner-1', requesterId: 'requester-1',
    },
  };
}

describe('NotificationStore durable PostgreSQL inbox', () => {
  it('persists newest-first and returns a defensive JSON copy', async () => {
    const db = fakeSharedDatabase();
    const store = new NotificationStore(db.client);
    const first = event('one');
    const second = event('two');
    expect(await store.record(first)).toBe(true);
    expect(await store.record(second)).toBe(true);
    const items = await store.recent();
    expect(items.map(item => item.event.eventId)).toEqual(['two', 'one']);
    if (items[0].event.type !== 'transaction.completed') throw new Error('bad test setup');
    items[0].event.data.transactionId = 'mutated';
    const returned = (await store.recent())[0].event;
    if (returned.type !== 'transaction.completed') throw new Error('bad test setup');
    expect(returned.data.transactionId).toBe('tx-1');
  });

  it('deduplicates across two replicas and after a restart via the shared unique key', async () => {
    const db = fakeSharedDatabase();
    const replicaA = new NotificationStore(db.client);
    const replicaB = new NotificationStore(db.client);
    const envelope = event('original-id');
    const [one, two] = await Promise.all([
      replicaA.record(envelope), replicaB.record(envelope),
    ]);
    expect([one, two].sort()).toEqual([false, true]);
    const restarted = new NotificationStore(db.client);
    expect(await restarted.record(envelope)).toBe(false);
    expect(await restarted.recent()).toHaveLength(1);
  });

  it('does not silently acknowledge database errors', async () => {
    const db = fakeSharedDatabase();
    const store = new NotificationStore(db.client);
    jest.spyOn(db.client.notificationEvent, 'createMany').mockRejectedValueOnce(
      new Error('PostgreSQL unavailable'),
    );
    await expect(store.record(event('uncommitted'))).rejects.toThrow('PostgreSQL unavailable');
    expect(db.rows.has('uncommitted')).toBe(false);
  });
});
