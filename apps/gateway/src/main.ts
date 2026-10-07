import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';
import {
  createGatewayObservabilityMiddleware,
  GatewayMetrics,
} from './observability';
import { createProxyMiddleware } from './proxy';

try {
  loadEnvFile('.env');
} catch {
  // Runtime environments may provide variables directly.
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GatewayModule, {
    bodyParser: false,
  });

  const port = Number(process.env.PORT ?? 3000);
  const webOrigins = (
    process.env.WEB_ORIGIN ??
    'http://localhost:3001,http://127.0.0.1:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: webOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
    ],
  });

  const httpAdapter = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => void;
    use: (
      middleware: (
        request: Parameters<
          ReturnType<typeof createProxyMiddleware>
        >[0],
        response: Parameters<
          ReturnType<typeof createProxyMiddleware>
        >[1],
        next: () => void,
      ) => void,
    ) => void;
  };

  httpAdapter.disable?.('x-powered-by');
  httpAdapter.use(
    createGatewayObservabilityMiddleware(
      app.get(GatewayMetrics),
    ),
  );

  httpAdapter.use(
    createProxyMiddleware({
      catalog: new URL(
        process.env.CATALOG_SERVICE_URL ??
          'http://127.0.0.1:3101',
      ),
      marketplace: new URL(
        process.env.MARKETPLACE_SERVICE_URL ??
          'http://127.0.0.1:3102',
      ),
      legacy: new URL(
        process.env.LEGACY_API_URL ??
          'http://127.0.0.1:3099',
      ),
    }),
  );

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
