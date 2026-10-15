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
