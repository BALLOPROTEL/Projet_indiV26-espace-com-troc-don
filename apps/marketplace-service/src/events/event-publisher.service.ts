import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from 'amqplib';
import { randomUUID } from 'node:crypto';
import {
  MARKETPLACE_EVENTS_EXCHANGE,
  MARKETPLACE_EVENT_VERSION,
  type MarketplaceEventEnvelope,
  type MarketplaceEventType,
} from './event-contract';

@Injectable()
export class MarketplaceEventPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MarketplaceEventPublisher.name);
  private connection?: RecoveringChannelModel;
  private channel?: ConfirmChannel;
  private startPromise?: Promise<void>;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.start().catch((error: unknown) => {
      this.logger.error(
        `RabbitMQ publisher bootstrap failed: ${this.message(error)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.ready = false;
    this.channel = undefined;

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
    return this.ready;
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    await this.start();

    const deadline = Date.now() + timeoutMs;

    while (!this.ready) {
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
    const channel = this.channel;

    if (!this.ready || !channel) {
      this.logger.warn(
        `RabbitMQ event skipped because publisher is not ready: ${type}`,
      );
      return false;
    }

    const event: MarketplaceEventEnvelope = {
      eventId: randomUUID(),
      type,
      version: MARKETPLACE_EVENT_VERSION,
      occurredAt: new Date().toISOString(),
      source: 'marketplace-service',
      data,
    };

    try {
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
      await channel.waitForConfirms();

      this.logger.log(
        `RabbitMQ event published: ${type} (${event.eventId})`,
      );
      return true;
    } catch (error) {
      this.ready = false;
      this.logger.error(
        `RabbitMQ publish failed for ${type}: ${this.message(error)}`,
      );
      return false;
    }
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
        setup: async (model: ChannelModel) => {
          this.ready = false;

          const channel = await model.createConfirmChannel();
          await channel.assertExchange(
            MARKETPLACE_EVENTS_EXCHANGE,
            'topic',
            { durable: true },
          );

          channel.on('error', (error) => {
            this.ready = false;
            this.logger.error(
              `RabbitMQ publisher channel error: ${error.message}`,
            );
          });
          channel.on('close', () => {
            this.ready = false;
          });
          channel.on('handler-error', (error, eventName) => {
            this.logger.error(
              `RabbitMQ publisher handler error (${eventName}): ${error.message}`,
            );
          });

          this.channel = channel;
          this.ready = true;
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
    connection.on('handler-error', (error, eventName) => {
      this.logger.error(
        `RabbitMQ publisher connection handler error (${eventName}): ${error.message}`,
      );
    });
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
