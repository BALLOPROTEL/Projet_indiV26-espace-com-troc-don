export const MARKETPLACE_EVENTS_EXCHANGE = 'marketplace.events';
export const NOTIFICATION_QUEUE = 'notification.marketplace-events.v1';
export const NOTIFICATION_BINDINGS = [
  'proposal.*',
  'transaction.*',
] as const;
export const MARKETPLACE_EVENT_VERSION = 1 as const;

export const MARKETPLACE_EVENT_TYPES = {
  PROPOSAL_CREATED: 'proposal.created',
  PROPOSAL_ACCEPTED: 'proposal.accepted',
  TRANSACTION_COMPLETED: 'transaction.completed',
} as const;

export type MarketplaceEventType =
  (typeof MARKETPLACE_EVENT_TYPES)[keyof typeof MARKETPLACE_EVENT_TYPES];

export type MarketplaceEventEnvelope = {
  eventId: string;
  type: MarketplaceEventType;
  version: typeof MARKETPLACE_EVENT_VERSION;
  occurredAt: string;
  source: 'marketplace-service';
  data: Record<string, string | null>;
};
