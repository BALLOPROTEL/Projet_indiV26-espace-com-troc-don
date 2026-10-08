import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveGatewayRoute } from '../../apps/gateway/dist/routes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const contracts = [
  ['/api/listings', 'catalog', '/listings'],
  ['/api/listings/me', 'catalog', '/listings/me'],
  ['/api/listings/abc-123/images', 'catalog', '/listings/abc-123/images'],
  ['/api/moderation/listings/abc-123/approve', 'catalog', '/moderation/listings/abc-123/approve'],
  ['/api/proposals', 'marketplace', '/proposals'],
  ['/api/proposals/me', 'marketplace', '/proposals/me'],
  ['/api/proposals/abc-123/accept', 'marketplace', '/proposals/abc-123/accept'],
  ['/api/transactions/me', 'marketplace', '/transactions/me'],
  ['/api/transactions/abc-123/confirm', 'marketplace', '/transactions/abc-123/confirm'],
  ['/api/auth/protected', 'legacy', '/api/auth/protected'],
  ['/api/health/live', 'gateway', '/api/health/live'],
  ['/api/health/ready', 'gateway', '/api/health/ready'],
  ['/api/metrics', 'gateway', '/api/metrics'],
];

test('M8 public Gateway contract: preserved HTTP paths and query strings', () => {
  for (const [publicPath, target, upstreamPath] of contracts) {
    assert.deepEqual(
      resolveGatewayRoute(publicPath + '?contract=m8'),
      { target, upstreamPath: upstreamPath + '?contract=m8' },
      publicPath,
    );
  }
});

test('M8 security contract: no public routing to Catalog internal APIs or private Notification', () => {
  for (const route of [
    '/api/internal/listings/abc-123',
    '/api/internal/listings/abc-123/reserve',
    '/api/notifications/recent',
    '/api/other',
  ]) {
    assert.equal(resolveGatewayRoute(route), null, route);
  }

  const catalog = source('apps/catalog-service/src/internal/internal-listings.controller.ts');
  assert.match(catalog, /@UseGuards\(InternalServiceGuard\)\s*@Controller\('internal\/listings'\)/);
  for (const marker of ["@Get(':id')", "@Post(':id/reserve')", "@Post(':id/complete')", "@Post(':id/release')"]) {
    assert.ok(catalog.includes(marker), 'Catalog internal contract missing: ' + marker);
  }

  const guard = source('apps/catalog-service/src/internal/internal-service.guard.ts');
  assert.match(guard, /x-internal-service-token/);
  assert.match(guard, /timingSafeEqual/);

  const client = source('apps/marketplace-service/src/catalog/catalog-client.service.ts');
  assert.match(client, /x-internal-service-token/);
  assert.match(client, /encodeURIComponent\(id\)/);
  for (const marker of ["'reserve'", "'complete'", "'release'"]) {
    assert.ok(client.includes(marker), 'Marketplace/Catalog action missing: ' + marker);
  }
});

test('M8 Marketplace contracts: proposals and transactions are JWT guarded', () => {
  const controllers = [
    ['apps/marketplace-service/src/proposals/proposals.controller.ts', 'proposals'],
    ['apps/marketplace-service/src/transactions/transactions.controller.ts', 'transactions'],
  ];
  for (const [filePath, resource] of controllers) {
    const content = source(filePath);
    assert.match(
      content,
      new RegExp("@UseGuards\\(JwtAuthGuard\\)\\s*@Controller\\('" + resource + "'\\)"),
      filePath,
    );
    assert.match(content, /request\.user\?\.sub/);
  }
});

test('M8 async contract: versioned RabbitMQ messages and Notification subscription', () => {
  const events = source('apps/marketplace-service/src/events/event-contract.ts');
  assert.match(events, /MARKETPLACE_EVENTS_EXCHANGE = 'marketplace\.events'/);
  assert.match(events, /NOTIFICATION_QUEUE = 'notification\.marketplace-events\.v1'/);
  assert.match(events, /MARKETPLACE_EVENT_VERSION = 1/);
  for (const type of ['proposal.created', 'proposal.accepted', 'transaction.completed']) {
    assert.ok(events.includes(type), 'Event contract missing: ' + type);
  }
  for (const field of ['eventId', 'type', 'version', 'occurredAt', 'source', 'data']) {
    assert.match(events, new RegExp('\\b' + field + ':'));
  }

  const publisher = source('apps/marketplace-service/src/events/event-publisher.service.ts');
  assert.match(publisher, /randomUUID\(\)/);
  assert.match(publisher, /waitForConfirms\(\)/);
  assert.match(publisher, /persistent: true/);
  assert.match(publisher, /NOTIFICATION_BINDINGS/);
  const notification = source('apps/notification-service/src/notifications/notifications.controller.ts');
  assert.match(notification, /@Controller\('notifications'\)/);
  assert.match(notification, /@Get\('recent'\)/);
});

test('M8 browser routing: app /api bypasses Web proxy for multipart uploads', () => {
  const ingress = source('infra/k8s/minikube/platform-ingress.yaml');
  const app = ingress.split('    - host: app.projet-indiv26.test')[1]
    ?.split('    - host: api.projet-indiv26.test')[0] ?? '';
  assert.match(app, /- path: \/api\s+pathType: Prefix\s+backend:\s+service:\s+name: gateway/);
  assert.match(app, /- path: \/\s+pathType: Prefix\s+backend:\s+service:\s+name: web/);
});
