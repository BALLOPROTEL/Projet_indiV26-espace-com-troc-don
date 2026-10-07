import assert from 'node:assert/strict';
import {
  createServer,
  get as httpGet,
} from 'node:http';
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
      'x-powered-by': 'upstream-framework',
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
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(
    response.headers.get('x-content-type-options'),
    'nosniff',
  );
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(observed, {
    method: 'GET',
    url: '/listings?status=APPROVED',
    authorization: 'Bearer m4-cert-token',
    host: upstreamUrl.host,
  });
});

test('streams multipart upload without re-encoding the request body', async (t) => {
  let observed;

  const upstream = createServer((request, response) => {
    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      observed = {
        method: request.method,
        url: request.url,
        contentType: request.headers['content-type'],
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks).toString('utf8'),
      };

      response.writeHead(200, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify({ uploaded: true }));
    });
  });

  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const gateway = createGateway(upstreamUrl);
  const gatewayUrl = await listen(gateway);
  t.after(() => close(gateway));

  const boundary = '----m4-gateway-boundary';
  const payload = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="images"; filename="proof.txt"\r\n',
    'Content-Type: text/plain\r\n\r\n',
    'm4-upload-proof\r\n',
    `--${boundary}--\r\n`,
  ].join('');

  const response = await fetch(
    new URL('/api/listings/listing-m4/images', gatewayUrl),
    {
      method: 'PUT',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: 'Bearer m4-cert-token',
      },
      body: payload,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { uploaded: true });
  assert.deepEqual(observed, {
    method: 'PUT',
    url: '/listings/listing-m4/images',
    contentType: `multipart/form-data; boundary=${boundary}`,
    authorization: 'Bearer m4-cert-token',
    body: payload,
  });
});

test('streams binary Catalog responses without re-encoding', async (t) => {
  const payload = Buffer.from([0, 1, 2, 127, 128, 253, 254, 255]);

  const upstream = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'image/png',
      'content-length': String(payload.length),
    });
    response.end(payload);
  });

  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const gateway = createGateway(upstreamUrl);
  const gatewayUrl = await listen(gateway);
  t.after(() => close(gateway));

  const response = await fetch(
    new URL(
      '/api/listings/listing-m4/images/image-m4/content/authorized',
      gatewayUrl,
    ),
    {
      headers: {
        Authorization: 'Bearer m4-cert-token',
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    payload,
  );
});

test('terminates the downstream response when upstream aborts mid-body', async (t) => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
    });
    response.write('partial-body');
    setImmediate(() => response.destroy());
  });

  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const gateway = createGateway(upstreamUrl);
  const gatewayUrl = await listen(gateway);
  t.after(() => close(gateway));

  const outcome = await Promise.race([
    new Promise((resolve) => {
      const request = httpGet(
        new URL('/api/listings/aborted', gatewayUrl),
        (response) => {
          response.on('end', () => resolve('end'));
          response.on('aborted', () => resolve('aborted'));
          response.on('error', () => resolve('error'));
          response.on('close', () => {
            if (!response.complete) {
              resolve('close');
            }
          });
        },
      );

      request.on('error', () => resolve('error'));
    }),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Gateway response remained pending')),
        1_500,
      );
    }),
  ]);

  assert.notEqual(outcome, 'end');
});
