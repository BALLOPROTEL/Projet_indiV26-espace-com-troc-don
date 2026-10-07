import {
  MARKETPLACE_EVENT_VERSION,
  parseMarketplaceEvent,
} from './event-contract';

describe('parseMarketplaceEvent', () => {
  it('accepts the M5 marketplace event envelope', () => {
    const event = parseMarketplaceEvent({
      eventId: 'event-1',
      type: 'proposal.created',
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: '2026-10-07T17:00:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'proposal-1',
        targetListingId: 'listing-1',
      },
    });

    expect(event.type).toBe('proposal.created');
    expect(event.data.proposalId).toBe('proposal-1');
  });

  it('rejects unsupported event versions', () => {
    expect(() =>
      parseMarketplaceEvent({
        eventId: 'event-1',
        type: 'proposal.created',
        version: 2,
        occurredAt: '2026-10-07T17:00:00.000Z',
        source: 'marketplace-service',
        data: {},
      }),
    ).toThrow('Unsupported RabbitMQ event version');
  });

  it('rejects unknown event types', () => {
    expect(() =>
      parseMarketplaceEvent({
        eventId: 'event-1',
        type: 'unknown.event',
        version: 1,
        occurredAt: '2026-10-07T17:00:00.000Z',
        source: 'marketplace-service',
        data: {},
      }),
    ).toThrow('Unsupported RabbitMQ event type');
  });
});
