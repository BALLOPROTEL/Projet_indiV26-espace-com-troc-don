import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';

type Dependency = {
  name: string;
  url: string;
};

@Controller('health')
export class HealthController {
  private readonly dependencies: Dependency[] = [
    {
      name: 'catalog',
      url: `${process.env.CATALOG_SERVICE_URL ?? 'http://127.0.0.1:3101'}/health/ready`,
    },
    {
      name: 'marketplace',
      url: `${process.env.MARKETPLACE_SERVICE_URL ?? 'http://127.0.0.1:3102'}/health/ready`,
    },
    {
      name: 'legacy',
      url: `${process.env.LEGACY_API_URL ?? 'http://127.0.0.1:3099'}/api/health/live`,
    },
  ];

  @Get('live')
  live() {
    return { status: 'ok', service: 'gateway' };
  }

  @Get('ready')
  async ready() {
    const states = await Promise.all(
      this.dependencies.map(async (dependency) => {
        try {
          const response = await fetch(dependency.url, {
            signal: AbortSignal.timeout(3_000),
          });
          return {
            name: dependency.name,
            ready: response.ok,
          };
        } catch {
          return {
            name: dependency.name,
            ready: false,
          };
        }
      }),
    );

    const unavailable = states
      .filter((state) => !state.ready)
      .map((state) => state.name);

    if (unavailable.length > 0) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'gateway',
        unavailable,
      });
    }

    return {
      status: 'ready',
      service: 'gateway',
      dependencies: states.map((state) => state.name),
    };
  }
}
