import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { MarketplaceEventType, MarketplaceEventEnvelope } from './event-contract';
import { MARKETPLACE_EVENT_VERSION } from './event-contract';
import { MarketplaceEventPublisher } from './event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PostgreSQL transactional outbox for proposal.rejected.
 *
 * The Proposal transition and outbox insert share one DB transaction.
 * This worker retries with a stable eventId until RabbitMQ confirms.
 * Concurrent Marketplace instances may send the same envelope; the
 * Notification inbox deduplicates atomically by eventId.
 */
@Injectable()
export class MarketplaceOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketplaceOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private current?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MarketplaceEventPublisher,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush().catch(error => {
      this.logger.error(`Outbox sweep failed: ${this.describe(error)}`);
    }), 1_000);
    this.timer.unref();
    void this.flush().catch(error => {
      this.logger.warn(`Initial outbox sweep deferred: ${this.describe(error)}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.current?.catch(() => undefined);
  }

  flush(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.current) return this.current;
    const work = this.deliverPending();
    this.current = work;
    void work.finally(() => {
      if (this.current === work) this.current = undefined;
    }).catch(() => undefined);
    return work;
  }

  private async deliverPending(): Promise<void> {
    const events = await this.prisma.marketplaceOutboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });

    for (const item of events) {
      if (this.stopping) return;
      const envelope: MarketplaceEventEnvelope = {
        eventId: item.eventId,
        type: item.type as MarketplaceEventType,
        version: MARKETPLACE_EVENT_VERSION,
        occurredAt: item.occurredAt.toISOString(),
        source: 'marketplace-service',
        data: item.payload as Record<string, string | null>,
      };
      // Always preserve the originally committed ID across retries.
      const published = await this.publisher.publishEnvelope(envelope);
      await this.prisma.marketplaceOutboxEvent.updateMany({
        where: { eventId: item.eventId, publishedAt: null },
        data: {
          attempts: { increment: 1 },
          ...(published ? { publishedAt: new Date() } : {}),
        },
      });
      if (!published) {
        this.logger.warn(`Outbox event ${item.eventId} remains pending for retry`);
        return;
      }
      this.logger.log(`Outbox delivered: ${item.type} (${item.eventId})`);
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
