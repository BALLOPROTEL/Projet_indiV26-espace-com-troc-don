import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const prisma = {
    ping: jest.fn(),
  } as unknown as PrismaService;

  const controller = new HealthController(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok for liveness', () => {
    expect(controller.liveness()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('returns ok when PostgreSQL is reachable', async () => {
    (prisma.ping as jest.Mock).mockResolvedValue(undefined);

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    (prisma.ping as jest.Mock).mockRejectedValue(new Error('db unavailable'));

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
