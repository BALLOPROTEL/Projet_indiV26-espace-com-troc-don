import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = process.env.MARKETPLACE_DATABASE_URL?.trim();

    if (!url) {
      throw new Error('MARKETPLACE_DATABASE_URL is required');
    }

    super({
      datasources: {
        db: {
          url,
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
