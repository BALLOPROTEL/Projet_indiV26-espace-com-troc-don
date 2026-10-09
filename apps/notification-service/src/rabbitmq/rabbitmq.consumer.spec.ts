import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import { HealthController } from '../health/health.controller';
import { NotificationStore } from '../notifications/notification.store';
import { RabbitMqConsumer } from './rabbitmq.consumer';

const valid = {
  eventId: 'valid-event',
  type: 'proposal.rejected',
  version: 1,
  occurredAt: '2026-10-10T00:00:00.000Z',
  source: 'marketplace-service',
  data: {
    proposalId: 'p1',
    targetListingId: 'l1',
    requesterId: 'r1',
    ownerId: 'o1',
  },
};

type ConsumerInternals = {
  ready: boolean;
  channel: Channel;
  consume: (channel: Channel, message: ConsumeMessage) => Promise<void>;
};

function harness() {
  const record = jest.fn();
  const checkReady = jest.fn().mockResolvedValue(undefined);
  const store = { record, checkReady } as unknown as NotificationStore;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const consumer = new RabbitMqConsumer(store, config);
  const channel = { ack: jest.fn(), nack: jest.fn() } as unknown as Channel;
  const internals = consumer as unknown as ConsumerInternals;
  internals.channel = channel;
  internals.ready = true;
  const health = new HealthController(consumer, store);
  const message = (payload: unknown): ConsumeMessage =>
    ({ content: Buffer.from(JSON.stringify(payload)) }) as ConsumeMessage;
  return { record, checkReady, consumer, channel, internals, health, message };
}

describe('RabbitMqConsumer — durable inbox resilience (Codex P1/P2)', () => {
  it('rejects unpersistable eventIds permanently without a poison requeue', async () => {
    const h = harness();
    await h.internals.consume(h.channel, h.message({
      ...valid, eventId: 'a'.repeat(129),
    }));
    expect(h.channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(h.channel.ack).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
    expect(h.consumer.isReady()).toBe(true);
  });

  it('requeues a temporary DB failure but preserves RabbitMQ readiness and recovers without restart', async () => {
    const h = harness();
    h.record.mockRejectedValueOnce(new Error('PostgreSQL outage')).mockResolvedValueOnce(true);
    h.checkReady.mockRejectedValueOnce(new Error('PostgreSQL outage'));
    jest.useFakeTimers();
    try {
      const incoming = h.message(valid);
      const first = h.internals.consume(h.channel, incoming);
      await jest.advanceTimersByTimeAsync(500);
      await first;
      expect(h.channel.nack).toHaveBeenCalledWith(incoming, false, true);
      expect(h.channel.ack).not.toHaveBeenCalled();
      // RabbitMQ channel still healthy; PostgreSQL readyness fails independently.
      expect(h.consumer.isReady()).toBe(true);
      await expect(h.health.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);

      const redelivered = h.message(valid);
      await h.internals.consume(h.channel, redelivered);
      expect(h.channel.ack).toHaveBeenCalledWith(redelivered);
      expect(h.consumer.isReady()).toBe(true);
      await expect(h.health.ready()).resolves.toMatchObject({
        status: 'ready',
        dependencies: ['rabbitmq', 'postgresql'],
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
