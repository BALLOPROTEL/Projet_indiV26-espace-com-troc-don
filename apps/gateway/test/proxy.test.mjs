import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createProxyMiddleware } from '../dist/proxy.js';

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

function createGateway(target) {
  const middleware = createProxyMiddleware({
    catalog: target,
    marketplace: target,
    legacy: target,
  });

  return createServer((request, response) => {
    middleware(request, response, () => {
      response.statusCode = 404;
      response.end('not routed');
    });
  });
}

test('forwards Catalog path, query string and Authorization header', async (t) => {
  let observed;

  const upstream = createServer((request, response) => {
    observed = {
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      host: request.headers.host,
    };

    response.writeHead(200, {
      'content-type': 'application/json',
      'x-upstream': 'catalog',
    });
    response.end(JSON.stringify({ ok: true }));
  });

  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const gateway = createGateway(upstreamUrl);
  const gatewayUrl = await listen(gateway);
  t.after(() => close(gateway));

  const response = await fetch(
    new URL('/api/listings?status=APPROVED', gatewayUrl),
    {
      headers: {
        Authorization: 'Bearer m4-cert-token',
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-upstream'), 'catalog');
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(observed, {
    method: 'GET',
    url: '/listings?status=APPROVED',
    authorization: 'Bearer m4-cert-token',
    host: upstreamUrl.host,
  });
});

test('streams Marketplace request body and preserves content type', async (t) => {
  let observed;

  const upstream = createServer((request, response) => {
    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      observed = {
        method: request.method,
        url: request.url,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      };

      response.writeHead(201, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify({ accepted: true }));
    });
  });

  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const gateway = createGateway(upstreamUrl);
  const gatewayUrl = await listen(gateway);
  t.after(() => close(gateway));

  const payload = JSON.stringify({
    targetListingId: 'listing-m4',
    type: 'DONATION_REQUEST',
  });

  const response = await fetch(new URL('/api/proposals', gatewayUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer m4-cert-token',
    },
    body: payload,
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.deepEqual(observed, {
    method: 'POST',
    url: '/proposals',
    contentType: 'application/json',
    body: payload,
  });
});
