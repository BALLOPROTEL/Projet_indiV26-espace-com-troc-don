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

test('keeps temporary legacy routes prefixed with /api', () => {
  assert.deepEqual(resolveGatewayRoute('/api/auth/user'), {
    target: 'legacy',
    upstreamPath: '/api/auth/user',
  });
  assert.deepEqual(resolveGatewayRoute('/api/metrics'), {
    target: 'legacy',
    upstreamPath: '/api/metrics',
  });
});

test('keeps gateway health local and rejects unknown routes', () => {
  assert.deepEqual(resolveGatewayRoute('/api/health/live'), {
    target: 'gateway',
    upstreamPath: '/api/health/live',
  });
  assert.equal(resolveGatewayRoute('/api/unknown'), null);
});
