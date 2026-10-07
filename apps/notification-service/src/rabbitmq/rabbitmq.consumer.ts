import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
  type RecoveringChannelModel,
} from 'amqplib';
import {
  MARKETPLACE_EVENTS_EXCHANGE,
  NOTIFICATION_QUEUE,
  parseMarketplaceEvent,
} from '../notifications/event-contract';
import { NotificationStore } from '../notifications/notification.store';

@Injectable()
export class RabbitMqConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqConsumer.name);
  private connection?: RecoveringChannelModel;
  private channel?: Channel;
  private startPromise?: Promise<void>;
  private rebuildPromise?: Promise<void>;
  private ready = false;
  private stopping = false;

  constructor(
    private readonly store: NotificationStore,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    void this.start().catch((error: unknown) => {
      this.logger.error(
        `RabbitMQ consumer bootstrap failed: ${this.message(error)}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.ready = false;

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
    return this.ready;
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    await this.start();

    const deadline = Date.now() + timeoutMs;

    while (!this.ready) {
      if (Date.now() >= deadline) {
        throw new Error('RabbitMQ consumer did not become ready');
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
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
          await this.installChannel(model);
        },
      },
    });

    this.connection = connection;

    connection.on('disconnect', (error) => {
      this.ready = false;
      this.channel = undefined;
      this.logger.warn(
        `RabbitMQ consumer disconnected: ${error.message}`,
      );
    });
    connection.on('connect-failed', (error) => {
      this.ready = false;
      this.logger.warn(
        `RabbitMQ consumer connection failed: ${error.message}`,
      );
    });
    connection.on('reconnect-scheduled', ({ attempt, delay }) => {
      this.logger.warn(
        `RabbitMQ consumer reconnect scheduled: attempt=${attempt} delay_ms=${delay}`,
      );
    });
    connection.on('reconnect-failed', (error) => {
      this.ready = false;
      this.logger.error(
        `RabbitMQ consumer reconnect exhausted: ${error.message}`,
      );
    });
    connection.on('handler-error', (error, eventName) => {
      this.logger.error(
        `RabbitMQ consumer connection handler error (${eventName}): ${error.message}`,
      );
    });
  }

  private async installChannel(model: ChannelModel): Promise<void> {
    const channel = await model.createChannel();

    await channel.assertExchange(
      MARKETPLACE_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
    await channel.assertQueue(NOTIFICATION_QUEUE, {
      durable: true,
    });
    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      MARKETPLACE_EVENTS_EXCHANGE,
      'proposal.*',
    );
    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      MARKETPLACE_EVENTS_EXCHANGE,
      'transaction.*',
    );
    await channel.prefetch(10);
    await channel.consume(
      NOTIFICATION_QUEUE,
      (message) => this.consume(channel, message),
      { noAck: false },
    );

    channel.on('error', (error) => {
      if (this.channel === channel) {
        this.ready = false;
      }
      this.logger.error(
        `RabbitMQ consumer channel error: ${error.message}`,
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
        `RabbitMQ consumer handler error (${eventName}): ${error.message}`,
      );
    });

    this.channel = channel;
    this.ready = true;
  }

  private consume(
    channel: Channel,
    message: ConsumeMessage | null,
  ): void {
    if (!message) {
      if (this.channel === channel) {
        this.channel = undefined;
        this.ready = false;
      }

      this.logger.warn(
        'RabbitMQ consumer was cancelled by the broker; recreating it',
      );
      void channel.close().catch(() => undefined);
      this.scheduleChannelRebuild();
      return;
    }

    try {
      const parsed = parseMarketplaceEvent(
        JSON.parse(message.content.toString('utf8')) as unknown,
      );
      const inserted = this.store.record(parsed);

      channel.ack(message);

      if (inserted) {
        this.logger.log(
          `Notification event consumed: ${parsed.type} (${parsed.eventId})`,
        );
      } else {
        this.logger.warn(
          `Duplicate RabbitMQ event ignored: ${parsed.eventId}`,
        );
      }
    } catch (error) {
      channel.nack(message, false, false);
      this.logger.warn(
        `Invalid RabbitMQ event discarded: ${this.message(error)}`,
      );
    }
  }

  private scheduleChannelRebuild(): void {
    if (
      this.stopping ||
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
          `RabbitMQ consumer channel rebuild failed: ${this.message(error)}`,
        );
      })
      .finally(() => {
        this.rebuildPromise = undefined;
      });
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
