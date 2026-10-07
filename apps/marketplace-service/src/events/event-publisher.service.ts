import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from 'amqplib';
import { randomUUID } from 'node:crypto';
import {
  MARKETPLACE_EVENTS_EXCHANGE,
  MARKETPLACE_EVENT_VERSION,
  NOTIFICATION_BINDINGS,
  NOTIFICATION_QUEUE,
  type MarketplaceEventEnvelope,
  type MarketplaceEventType,
} from './event-contract';

@Injectable()
export class MarketplaceEventPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MarketplaceEventPublisher.name);
  private readonly confirmTimeoutMs: number;
  private connection?: RecoveringChannelModel;
  private channel?: ConfirmChannel;
  private startPromise?: Promise<void>;
  private rebuildPromise?: Promise<void>;
  private ready = false;
  private blocked = false;
  private stopping = false;

  constructor(private readonly config: ConfigService) {
    const configuredTimeout = Number(
      this.config.get<string>('RABBITMQ_CONFIRM_TIMEOUT_MS') ?? '5000',
    );

    this.confirmTimeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 5000;
  }

  onModuleInit(): void {
    void this.start().catch((error: unknown) => {
      this.logger.error(
        `RabbitMQ publisher bootstrap failed: ${this.message(error)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.ready = false;
    this.blocked = false;

    const channel = this.channel;
    this.channel = undefined;

    if (channel) {
      await channel.close().catch(() => undefined);
    }

    if (this.connection) {
      await this.connection.close().catch(() => undefined);
      this.connection = undefined;
    }
  }

  start(): Promise<void> {
    this.startPromise ??= this.connect();
    return this.startPromise;
  }

  isReady(): boolean {
    return this.ready && !this.blocked;
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    await this.start();

    const deadline = Date.now() + timeoutMs;

    while (!this.isReady()) {
      if (Date.now() >= deadline) {
        throw new Error('RabbitMQ publisher did not become ready');
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async publish(
    type: MarketplaceEventType,
    data: Record<string, string | null>,
  ): Promise<boolean> {
    const event: MarketplaceEventEnvelope = {
      eventId: randomUUID(),
      type,
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: new Date().toISOString(),
      source: 'marketplace-service',
      data,
    };

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let channel: ConfirmChannel | undefined;

      try {
        await this.waitUntilReady(this.confirmTimeoutMs);
        channel = this.channel;

        if (!channel) {
          throw new Error('RabbitMQ confirm channel is unavailable');
        }

        channel.publish(
          MARKETPLACE_EVENTS_EXCHANGE,
          type,
          Buffer.from(JSON.stringify(event)),
          {
            contentType: 'application/json',
            persistent: true,
            messageId: event.eventId,
            type,
            timestamp: Date.now(),
          },
        );

        await this.withTimeout(
          channel.waitForConfirms(),
          this.confirmTimeoutMs,
          'RabbitMQ publisher confirm timed out',
        );

        this.logger.log(
          `RabbitMQ event published: ${type} (${event.eventId})`,
        );
        return true;
      } catch (error) {
        this.logger.warn(
          `RabbitMQ publish attempt ${attempt}/2 failed for ${type}: ${this.message(error)}`,
        );
        this.invalidateChannel(channel);
      }
    }

    this.logger.error(
      `RabbitMQ event delivery failed after retry: ${type} (${event.eventId})`,
    );
    return false;
  }

  private async connect(): Promise<void> {
    const url =
      this.config.get<string>('RABBITMQ_URL')?.trim() ??
      'amqp://app:rabbitmq_local_change_me_2026@127.0.0.1:5672';

    const connection = await connect(url, {
      recovery: {
        waitForConnect: false,
        initialDelay: 100,
        maxDelay: 5_000,
        factor: 2,
        jitter: 0.2,
        maxRetries: Number.POSITIVE_INFINITY,
        setup: async (
          model: { createConfirmChannel(): Promise<ConfirmChannel> },
        ) => {
          await this.installChannel(model);
        },
      },
    });

    this.connection = connection;

    connection.on('disconnect', (error) => {
      this.ready = false;
      this.channel = undefined;
      this.logger.warn(
        `RabbitMQ publisher disconnected: ${error.message}`,
      );
    });
    connection.on('connect-failed', (error) => {
      this.ready = false;
      this.logger.warn(
        `RabbitMQ publisher connection failed: ${error.message}`,
      );
    });
    connection.on('reconnect-scheduled', ({ attempt, delay }) => {
      this.logger.warn(
        `RabbitMQ publisher reconnect scheduled: attempt=${attempt} delay_ms=${delay}`,
      );
    });
    connection.on('reconnect-failed', (error) => {
      this.ready = false;
      this.logger.error(
        `RabbitMQ publisher reconnect exhausted: ${error.message}`,
      );
    });
    connection.on('blocked', (reason) => {
      this.blocked = true;
      this.ready = false;
      this.logger.warn(
        `RabbitMQ publisher connection blocked: ${reason}`,
      );
    });
    connection.on('unblocked', () => {
      this.blocked = false;

      if (this.channel) {
        this.ready = true;
      } else {
        this.scheduleChannelRebuild();
      }

      this.logger.log('RabbitMQ publisher connection unblocked');
    });
    connection.on('handler-error', (error, eventName) => {
      this.logger.error(
        `RabbitMQ publisher connection handler error (${eventName}): ${error.message}`,
      );
    });
  }

  private async installChannel(
    model: { createConfirmChannel(): Promise<ConfirmChannel> },
  ): Promise<void> {
    const channel = await model.createConfirmChannel();

    await channel.assertExchange(
      MARKETPLACE_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
    await channel.assertQueue(NOTIFICATION_QUEUE, {
      durable: true,
    });

    for (const binding of NOTIFICATION_BINDINGS) {
      await channel.bindQueue(
        NOTIFICATION_QUEUE,
        MARKETPLACE_EVENTS_EXCHANGE,
        binding,
      );
    }

    channel.on('error', (error) => {
      if (this.channel === channel) {
        this.ready = false;
      }
      this.logger.error(
        `RabbitMQ publisher channel error: ${error.message}`,
      );
    });
    channel.on('close', () => {
      if (this.channel === channel) {
        this.channel = undefined;
        this.ready = false;
        this.scheduleChannelRebuild();
      }
    });
    channel.on('handler-error', (error, eventName) => {
      this.logger.error(
        `RabbitMQ publisher handler error (${eventName}): ${error.message}`,
      );
    });

    this.channel = channel;
    this.ready = !this.blocked;
  }

  private invalidateChannel(channel?: ConfirmChannel): void {
    this.ready = false;

    if (channel && this.channel === channel) {
      this.channel = undefined;
    }

    if (channel) {
      void channel.close().catch(() => undefined);
    }

    this.scheduleChannelRebuild();
  }

  private scheduleChannelRebuild(): void {
    if (
      this.stopping ||
      this.blocked ||
      !this.connection ||
      this.rebuildPromise
    ) {
      return;
    }

    const model = this.connection;

    this.rebuildPromise = this.installChannel(model)
      .catch((error: unknown) => {
        this.ready = false;
        this.logger.warn(
          `RabbitMQ publisher channel rebuild failed: ${this.message(error)}`,
        );
      })
      .finally(() => {
        this.rebuildPromise = undefined;
      });
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(message)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
