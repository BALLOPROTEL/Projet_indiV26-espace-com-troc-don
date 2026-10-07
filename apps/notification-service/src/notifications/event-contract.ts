export const MARKETPLACE_EVENTS_EXCHANGE = 'marketplace.events';
export const NOTIFICATION_QUEUE = 'notification.marketplace-events.v1';
export const MARKETPLACE_EVENT_VERSION = 1 as const;

export const MARKETPLACE_EVENT_TYPES = [
  'proposal.created',
  'proposal.accepted',
  'transaction.completed',
] as const;

export type MarketplaceEventType =
  (typeof MARKETPLACE_EVENT_TYPES)[number];

type ProposalCreatedData = {
  proposalId: string;
  targetListingId: string;
  requesterId: string;
  proposalType: 'DONATION_REQUEST' | 'TRADE_OFFER';
  offeredListingId: string | null;
};

type ProposalAcceptedData = {
  proposalId: string;
  transactionId: string;
  targetListingId: string;
  offeredListingId: string | null;
  ownerId: string;
  requesterId: string;
};

type TransactionCompletedData = {
  transactionId: string;
  proposalId: string;
  targetListingId: string;
  offeredListingId: string | null;
  ownerId: string;
  requesterId: string;
};

type MarketplaceEventDataMap = {
  'proposal.created': ProposalCreatedData;
  'proposal.accepted': ProposalAcceptedData;
  'transaction.completed': TransactionCompletedData;
};

type MarketplaceEventBase<T extends MarketplaceEventType> = {
  eventId: string;
  type: T;
  version: typeof MARKETPLACE_EVENT_VERSION;
  occurredAt: string;
  source: 'marketplace-service';
  data: MarketplaceEventDataMap[T];
};

export type MarketplaceEventEnvelope = {
  [T in MarketplaceEventType]: MarketplaceEventBase<T>;
}[MarketplaceEventType];

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredString(
  data: Record<string, unknown>,
  field: string,
): string {
  const value = data[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`RabbitMQ event data.${field} must be a non-empty string`);
  }

  return value;
}

function nullableString(
  data: Record<string, unknown>,
  field: string,
): string | null {
  const value = data[field];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `RabbitMQ event data.${field} must be null or a non-empty string`,
    );
  }

  return value;
}

function commonEnvelope(
  value: Record<string, unknown>,
): {
  eventId: string;
  version: typeof MARKETPLACE_EVENT_VERSION;
  occurredAt: string;
  source: 'marketplace-service';
  data: Record<string, unknown>;
} {
  if (
    typeof value.eventId !== 'string' ||
    value.eventId.trim().length === 0
  ) {
    throw new Error('RabbitMQ eventId is required');
  }

  if (value.version !== MARKETPLACE_EVENT_VERSION) {
    throw new Error('Unsupported RabbitMQ event version');
  }

  if (
    typeof value.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(value.occurredAt))
  ) {
    throw new Error('RabbitMQ occurredAt must be an ISO date');
  }

  if (value.source !== 'marketplace-service') {
    throw new Error('Unexpected RabbitMQ event source');
  }

  if (!isRecord(value.data)) {
    throw new Error('RabbitMQ event data must be an object');
  }

  return {
    eventId: value.eventId,
    version: MARKETPLACE_EVENT_VERSION,
    occurredAt: value.occurredAt,
    source: 'marketplace-service',
    data: value.data,
  };
}

export function parseMarketplaceEvent(
  value: unknown,
): MarketplaceEventEnvelope {
  if (!isRecord(value)) {
    throw new Error('RabbitMQ event must be an object');
  }

  if (
    typeof value.type !== 'string' ||
    !MARKETPLACE_EVENT_TYPES.includes(
      value.type as MarketplaceEventType,
    )
  ) {
    throw new Error('Unsupported RabbitMQ event type');
  }

  const base = commonEnvelope(value);

  switch (value.type) {
    case 'proposal.created': {
      const proposalType = requiredString(base.data, 'proposalType');

      if (
        proposalType !== 'DONATION_REQUEST' &&
        proposalType !== 'TRADE_OFFER'
      ) {
        throw new Error(
          'RabbitMQ event data.proposalType is invalid',
        );
      }

      return {
        ...base,
        type: 'proposal.created',
        data: {
          proposalId: requiredString(base.data, 'proposalId'),
          targetListingId: requiredString(
            base.data,
            'targetListingId',
          ),
          requesterId: requiredString(base.data, 'requesterId'),
          proposalType,
          offeredListingId: nullableString(
            base.data,
            'offeredListingId',
          ),
        },
      };
    }

    case 'proposal.accepted':
      return {
        ...base,
        type: 'proposal.accepted',
        data: {
          proposalId: requiredString(base.data, 'proposalId'),
          transactionId: requiredString(
            base.data,
            'transactionId',
          ),
          targetListingId: requiredString(
            base.data,
            'targetListingId',
          ),
          offeredListingId: nullableString(
            base.data,
            'offeredListingId',
          ),
          ownerId: requiredString(base.data, 'ownerId'),
          requesterId: requiredString(base.data, 'requesterId'),
        },
      };

    case 'transaction.completed':
      return {
        ...base,
        type: 'transaction.completed',
        data: {
          transactionId: requiredString(
            base.data,
            'transactionId',
          ),
          proposalId: requiredString(base.data, 'proposalId'),
          targetListingId: requiredString(
            base.data,
            'targetListingId',
          ),
          offeredListingId: nullableString(
            base.data,
            'offeredListingId',
          ),
          ownerId: requiredString(base.data, 'ownerId'),
          requesterId: requiredString(base.data, 'requesterId'),
        },
      };
  }
}
