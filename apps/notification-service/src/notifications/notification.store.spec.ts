import type { MarketplaceEventEnvelope } from './event-contract';
import { NotificationStore } from './notification.store';

describe('NotificationStore', () => {
  const event = (
    eventId: string,
  ): MarketplaceEventEnvelope => ({
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
  });

  it('stores consumed events newest first and returns a defensive copy', () => {
    const store = new NotificationStore();
    const first: MarketplaceEventEnvelope = {
      eventId: 'event-1',
      type: 'proposal.created',
      version: 1,
      occurredAt: '2026-10-07T17:00:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'proposal-1',
        targetListingId: 'target-1',
        requesterId: 'requester-1',
        proposalType: 'DONATION_REQUEST',
        offeredListingId: null,
      },
    };
    const second = event('event-2');

    expect(store.record(first)).toBe(true);
    expect(store.record(second)).toBe(true);

    const recent = store.recent();

    expect(recent.map((item) => item.event.eventId)).toEqual([
      'event-2',
      'event-1',
    ]);

    recent[0].event.data.transactionId = 'mutated';

    expect(store.recent()[0].event.data.transactionId).toBe('tx-1');
  });

  it('deduplicates RabbitMQ redeliveries by eventId', () => {
    const store = new NotificationStore();
    const value = event('event-redelivery');

    expect(store.record(value)).toBe(true);
    expect(store.record(value)).toBe(false);
    expect(store.recent()).toHaveLength(1);
  });
});
