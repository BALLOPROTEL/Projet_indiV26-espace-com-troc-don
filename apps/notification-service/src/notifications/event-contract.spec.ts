import {
  MARKETPLACE_EVENT_VERSION,
  parseMarketplaceEvent,
} from './event-contract';

describe('parseMarketplaceEvent', () => {
  it('accepts the M5 proposal.created envelope', () => {
    const event = parseMarketplaceEvent({
      eventId: 'event-1',
      type: 'proposal.created',
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: '2026-10-07T17:00:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'proposal-1',
        targetListingId: 'listing-1',
        requesterId: 'requester-1',
        proposalType: 'DONATION_REQUEST',
        offeredListingId: null,
      },
    });

    expect(event.type).toBe('proposal.created');
    expect(event.data.proposalId).toBe('proposal-1');
  });

  it('accepts the M9 proposal.rejected envelope with owner and requester', () => {
    const event = parseMarketplaceEvent({
      eventId: 'rejected-m9',
      type: 'proposal.rejected',
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: '2026-10-10T00:00:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'proposal-m9',
        targetListingId: 'target-m9',
        requesterId: 'requester-1',
        ownerId: 'owner-1',
      },
    });

    expect(event.type).toBe('proposal.rejected');
    expect(event.data.proposalId).toBe('proposal-m9');
  });

  it('rejects incomplete proposal.rejected payloads', () => {
    expect(() => parseMarketplaceEvent({
      eventId: 'rejected-invalid',
      type: 'proposal.rejected',
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: '2026-10-10T00:00:00.000Z',
      source: 'marketplace-service',
      data: {
        proposalId: 'proposal-m9',
        targetListingId: 'target-m9',
        requesterId: 'requester-1',
      },
    })).toThrow('data.ownerId');
  });

  it('accepts the maximum persisted eventId length (128)', () => {
    const event = parseMarketplaceEvent({
      eventId: 'a'.repeat(128), type: 'proposal.rejected', version: 1,
      occurredAt: '2026-10-10T00:00:00.000Z', source: 'marketplace-service',
      data: { proposalId: 'p', targetListingId: 'l', requesterId: 'r', ownerId: 'o' },
    });
    expect(event.eventId).toHaveLength(128);
  });

  it('rejects oversized IDs before the message reaches the database', () => {
    expect(() => parseMarketplaceEvent({
      eventId: 'a'.repeat(129), type: 'proposal.rejected', version: 1,
      occurredAt: '2026-10-10T00:00:00.000Z', source: 'marketplace-service',
      data: { proposalId: 'p', targetListingId: 'l', requesterId: 'r', ownerId: 'o' },
    })).toThrow('RabbitMQ eventId must be at most 128 characters');
  });

  it('rejects unsupported event versions', () => {
    expect(() =>
      parseMarketplaceEvent({
        eventId: 'event-1',
        type: 'proposal.created',
        version: 2,
        occurredAt: '2026-10-07T17:00:00.000Z',
        source: 'marketplace-service',
        data: {
          proposalId: 'proposal-1',
          targetListingId: 'listing-1',
          requesterId: 'requester-1',
          proposalType: 'DONATION_REQUEST',
          offeredListingId: null,
        },
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

  it('rejects known event types with incomplete payloads', () => {
    expect(() =>
      parseMarketplaceEvent({
        eventId: 'event-2',
        type: 'transaction.completed',
        version: 1,
        occurredAt: '2026-10-07T17:02:00.000Z',
        source: 'marketplace-service',
        data: {
          transactionId: 'tx-1',
        },
      }),
    ).toThrow('RabbitMQ event data.proposalId');
  });
});
