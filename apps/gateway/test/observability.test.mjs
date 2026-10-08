import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  createGatewayObservabilityMiddleware,
  GatewayMetrics,
} from '../dist/observability.js';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address'));
        return;
      }

      resolve(new URL(`http://127.0.0.1:${address.port}`));
    });
  });
}

function close(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

test('adds security headers, request correlation and Gateway metrics', async (t) => {
  const metrics = new GatewayMetrics();
  const middleware =
    createGatewayObservabilityMiddleware(metrics);

  const server = createServer((request, response) => {
    response.setHeader('X-Powered-By', 'Express');

    middleware(request, response, () => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          requestId: request.headers['x-request-id'],
        }),
      );
    });
  });

  const origin = await listen(server);
  t.after(() => close(server));

  const response = await fetch(
    new URL('/api/listings', origin),
    {
      headers: {
        'X-Request-ID': 'm4-codex-review',
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('x-request-id'),
    'm4-codex-review',
  );
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(
    response.headers.get('x-content-type-options'),
    'nosniff',
  );
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(
    response.headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
  );
  assert.match(
    response.headers.get('permissions-policy') ?? '',
    /camera=\(\)/,
  );

  assert.deepEqual(await response.json(), {
    requestId: 'm4-codex-review',
  });

  const exposition = metrics.metrics();
  assert.match(
    exposition,
    /projet_indiv26_http_requests_total\{method="GET",route="\/api\/listings",status_code="200"\} 1/,
  );
  assert.match(
    exposition,
    /projet_indiv26_http_request_duration_seconds_count\{method="GET",route="\/api\/listings",status_code="200"\} 1/,
  );
  assert.match(
    exposition,
    /^projet_indiv26_process_resident_memory_bytes [0-9]+$/m,
  );
  assert.match(
    exposition,
    /^projet_indiv26_process_cpu_seconds_total [0-9]+(?:\.[0-9]+)?$/m,
  );

});
