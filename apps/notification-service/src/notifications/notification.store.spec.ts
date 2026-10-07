import type { MarketplaceEventEnvelope } from './event-contract';
import { NotificationStore } from './notification.store';

describe('NotificationStore', () => {
  it('stores consumed events newest first and returns a defensive copy', () => {
    const store = new NotificationStore();

    const first: MarketplaceEventEnvelope = {
      eventId: 'event-1',
      type: 'proposal.created',
      version: 1,
      occurredAt: '2026-10-07T17:00:00.000Z',
      source: 'marketplace-service',
      data: { proposalId: 'proposal-1' },
    };
    const second: MarketplaceEventEnvelope = {
      eventId: 'event-2',
      type: 'transaction.completed',
      version: 1,
      occurredAt: '2026-10-07T17:01:00.000Z',
      source: 'marketplace-service',
      data: { transactionId: 'tx-1' },
    };

    store.record(first);
    store.record(second);

    const recent = store.recent();

    expect(recent.map((item) => item.event.eventId)).toEqual([
      'event-2',
      'event-1',
    ]);

    recent[0].event.data.transactionId = 'mutated';

    expect(store.recent()[0].event.data.transactionId).toBe('tx-1');
  });
});
