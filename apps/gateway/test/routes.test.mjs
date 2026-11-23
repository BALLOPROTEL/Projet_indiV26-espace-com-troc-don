import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGatewayRoute } from '../dist/routes.js';

test('routes Catalog public contracts', () => {
  assert.deepEqual(resolveGatewayRoute('/api/listings?status=APPROVED'), {
    target: 'catalog',
    upstreamPath: '/listings?status=APPROVED',
  });
  assert.deepEqual(
    resolveGatewayRoute('/api/moderation/listings/abc/approve'),
    {
      target: 'catalog',
      upstreamPath: '/moderation/listings/abc/approve',
    },
  );
  assert.deepEqual(resolveGatewayRoute('/api/moderation/reports?status=OPEN'), {
    target: 'catalog',
    upstreamPath: '/moderation/reports?status=OPEN',
  });
  assert.deepEqual(resolveGatewayRoute('/api/listings/abc/reports'), {
    target: 'catalog',
    upstreamPath: '/listings/abc/reports',
  });
  assert.deepEqual(resolveGatewayRoute('/api/favorites'), {
    target: 'catalog',
    upstreamPath: '/favorites',
  });
  assert.deepEqual(resolveGatewayRoute('/api/favorites/listing-1'), {
    target: 'catalog',
    upstreamPath: '/favorites/listing-1',
  });
});

test('routes Product public and explicit ADMIN contracts', () => {
  assert.deepEqual(resolveGatewayRoute('/api/products?q=figurine'), {
    target: 'catalog',
    upstreamPath: '/products?q=figurine',
  });
  assert.deepEqual(resolveGatewayRoute('/api/products/figurine-test'), {
    target: 'catalog',
    upstreamPath: '/products/figurine-test',
  });
  assert.deepEqual(resolveGatewayRoute('/api/admin/products'), {
    target: 'catalog',
    upstreamPath: '/admin/products',
  });
  assert.deepEqual(
    resolveGatewayRoute('/api/admin/products/product-1/publish'),
    {
      target: 'catalog',
      upstreamPath: '/admin/products/product-1/publish',
    },
  );
  assert.equal(resolveGatewayRoute('/api/admin/orders'), null);
});

test('routes Marketplace public contracts', () => {
  assert.deepEqual(resolveGatewayRoute('/api/proposals/me'), {
    target: 'marketplace',
    upstreamPath: '/proposals/me',
  });
  assert.deepEqual(
    resolveGatewayRoute('/api/transactions/tx-1/confirm'),
    {
      target: 'marketplace',
      upstreamPath: '/transactions/tx-1/confirm',
    },
  );
  assert.deepEqual(
    resolveGatewayRoute('/api/conversations/conversation-1/messages?limit=20'),
    {
      target: 'marketplace',
      upstreamPath: '/conversations/conversation-1/messages?limit=20',
    },
  );
});

test('routes explicit cart and order contracts to Commerce', () => {
  assert.deepEqual(resolveGatewayRoute('/api/cart'), {
    target: 'commerce',
    upstreamPath: '/cart',
  });
  assert.deepEqual(resolveGatewayRoute('/api/cart/items/variant-1'), {
    target: 'commerce',
    upstreamPath: '/cart/items/variant-1',
  });
  assert.deepEqual(resolveGatewayRoute('/api/orders'), {
    target: 'commerce',
    upstreamPath: '/orders',
  });
  assert.deepEqual(resolveGatewayRoute('/api/orders/order-1'), {
    target: 'commerce',
    upstreamPath: '/orders/order-1',
  });
  assert.equal(resolveGatewayRoute('/api/checkout'), null);
});

test('routes only the authenticated notification inbox', () => {
  assert.deepEqual(resolveGatewayRoute('/api/notifications/me'), {
    target: 'notification',
    upstreamPath: '/notifications/me',
  });
  assert.equal(resolveGatewayRoute('/api/notifications/recent'), null);
  assert.equal(resolveGatewayRoute('/api/notifications/other'), null);
});

test('keeps temporary auth fallback prefixed with /api', () => {
  assert.deepEqual(resolveGatewayRoute('/api/auth/user'), {
    target: 'legacy',
    upstreamPath: '/api/auth/user',
  });
});

test('keeps Gateway-owned health and metrics local', () => {
  assert.deepEqual(resolveGatewayRoute('/api/health/live'), {
    target: 'gateway',
    upstreamPath: '/api/health/live',
  });
  assert.deepEqual(resolveGatewayRoute('/api/metrics'), {
    target: 'gateway',
    upstreamPath: '/api/metrics',
  });
  assert.equal(resolveGatewayRoute('/api/unknown'), null);
});

test('routes the exact ADMIN catalog summary without exposing unrelated admin paths', () => {
  assert.deepEqual(resolveGatewayRoute('/api/admin/catalog/summary'), {
    target: 'catalog',
    upstreamPath: '/admin/catalog/summary',
  });
  assert.deepEqual(resolveGatewayRoute('/api/admin/catalog/summary?audit=1'), {
    target: 'catalog',
    upstreamPath: '/admin/catalog/summary?audit=1',
  });
  assert.equal(resolveGatewayRoute('/api/admin/users'), null);
  assert.equal(resolveGatewayRoute('/api/admin/catalog/internal'), null);
});
