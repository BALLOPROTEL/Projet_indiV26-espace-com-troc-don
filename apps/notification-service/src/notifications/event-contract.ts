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

export type MarketplaceEventEnvelope = {
  eventId: string;
  type: MarketplaceEventType;
  version: typeof MARKETPLACE_EVENT_VERSION;
  occurredAt: string;
  source: 'marketplace-service';
  data: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function parseMarketplaceEvent(
  value: unknown,
): MarketplaceEventEnvelope {
  if (!isRecord(value)) {
    throw new Error('RabbitMQ event must be an object');
  }

  if (
    typeof value.eventId !== 'string' ||
    value.eventId.length === 0
  ) {
    throw new Error('RabbitMQ eventId is required');
  }

  if (
    typeof value.type !== 'string' ||
    !MARKETPLACE_EVENT_TYPES.includes(
      value.type as MarketplaceEventType,
    )
  ) {
    throw new Error('Unsupported RabbitMQ event type');
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
    type: value.type as MarketplaceEventType,
    version: MARKETPLACE_EVENT_VERSION,
    occurredAt: value.occurredAt,
    source: 'marketplace-service',
    data: value.data,
  };
}
