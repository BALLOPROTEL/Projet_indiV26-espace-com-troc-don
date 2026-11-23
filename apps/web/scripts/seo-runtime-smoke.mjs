import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import process from 'node:process';

const WEB_ORIGIN = process.env.SEO_SMOKE_WEB_ORIGIN ?? 'http://127.0.0.1:3001';
const MOCK_HOST = '127.0.0.1';
const MOCK_PORT = Number(process.env.SEO_SMOKE_GATEWAY_PORT ?? 39113);
const MOCK_ORIGIN = `http://${MOCK_HOST}:${MOCK_PORT}`;

const listing = {
  id: 'found-seo-smoke',
  ownerId: 'seo-smoke-owner',
  title: 'Objet SEO de test',
  description:
    'Annonce publique utilisée pour vérifier les métadonnées, le canonical et le sitemap en production.',
  operationType: 'DONATION',
  status: 'APPROVED',
  availabilityStatus: 'AVAILABLE',
  moderationReason: null,
  createdAt: '2026-11-20T23:30:00.000Z',
  updatedAt: '2026-11-20T10:05:00.000Z',
  images: [
    {
      id: 'seo-image-1',
      position: 0,
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
      contentUrl:
        '/api/listings/found-seo-smoke/images/seo-image-1/content',
    },
  ],
  tradeWishes: [],
};

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const gateway = createServer((request, response) => {
  if (request.method !== 'GET') {
    json(response, 405, { message: 'Method not allowed' });
    return;
  }

  if (request.url === '/api/listings') {
    json(response, 200, [listing]);
    return;
  }

  if (request.url === '/api/listings/found-seo-smoke') {
    json(response, 200, listing);
    return;
  }

  if (request.url === '/api/listings/missing-seo-smoke') {
    json(response, 404, { message: 'Listing not found' });
    return;
  }

  json(response, 404, { message: 'Mock route not found' });
});

gateway.listen(MOCK_PORT, MOCK_HOST);
await once(gateway, 'listening');

const logs = [];
const web = spawn('pnpm', ['--filter', 'web', 'start'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    API_INTERNAL_URL: MOCK_ORIGIN,
    NEXT_PUBLIC_SITE_URL: WEB_ORIGIN,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});

for (const stream of [web.stdout, web.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    logs.push(chunk);
    if (logs.length > 80) logs.shift();
  });
}

function fail(message) {
  const tail = logs.join('').trim();
  throw new Error(tail ? `${message}\n--- next start ---\n${tail}` : message);
}

function signalWebTree(signal) {
  if (process.platform !== 'win32' && web.pid) {
    try {
      process.kill(-web.pid, signal);
      return;
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }

  if (web.exitCode === null) {
    web.kill(signal);
  }
}

async function waitForWeb() {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (web.exitCode !== null) {
      fail(`next start exited early with code ${web.exitCode}`);
    }

    try {
      const response = await fetch(`${WEB_ORIGIN}/`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return;
    } catch {
      // Keep polling while Next.js starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  fail('Next.js did not become ready within 45 seconds');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fetchHtml(path) {
  const response = await fetch(`${WEB_ORIGIN}${path}`, {
    headers: {
      accept: 'text/html',
      'user-agent': 'seo-runtime-smoke/1.0',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  return { response, html: await response.text() };
}

function metaContent(html, selectorAttribute, selectorValue) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)=(["'])(.*?)\2/g)].map(
        ([, name, , value]) => [name.toLowerCase(), value],
      ),
    );

    if (
      attributes[selectorAttribute.toLowerCase()] === selectorValue &&
      typeof attributes.content === 'string'
    ) {
      return attributes.content;
    }
  }

  return null;
}

try {
  await waitForWeb();

  const found = await fetchHtml('/annonces/found-seo-smoke');
  assert(found.response.status === 200, `Expected found listing HTTP 200, got ${found.response.status}`);
  assert(found.html.includes('Objet SEO de test'), 'Dynamic listing title is missing from rendered HTML');
  assert(found.html.includes('rel="canonical"'), 'Canonical link is missing from listing HTML');
  assert(found.html.includes('/annonces/found-seo-smoke'), 'Canonical listing path is missing from listing HTML');
  assert(found.html.includes('property="og:title"'), 'Open Graph title is missing from listing HTML');
  const expectedSocialImage =
    'http://localhost:3000/api/listings/found-seo-smoke/images/seo-image-1/content';
  assert(
    metaContent(found.html, 'property', 'og:image') === expectedSocialImage,
    'og:image must resolve on the public API origin when API and Web origins differ',
  );
  assert(
    metaContent(found.html, 'name', 'twitter:image') === expectedSocialImage,
    'twitter:image must resolve on the public API origin when API and Web origins differ',
  );
  assert(
    found.html.includes('21 nov. 2026'),
    'SSR listing date must use the same Europe/Paris timezone as hydration',
  );

  const missing = await fetchHtml('/annonces/missing-seo-smoke');
  assert(missing.response.status === 404, `Expected missing listing HTTP 404, got ${missing.response.status}`);
  assert(
    missing.html.includes('Cette page s’est égarée.') ||
      missing.html.includes('Page introuvable'),
    'Custom not-found UI is missing from HTTP 404 response',
  );

  const sitemap = await fetch(`${WEB_ORIGIN}/sitemap.xml`, {
    signal: AbortSignal.timeout(10_000),
  });
  const sitemapXml = await sitemap.text();
  assert(sitemap.status === 200, `Expected sitemap HTTP 200, got ${sitemap.status}`);
  assert(
    sitemapXml.includes('/annonces/found-seo-smoke'),
    'Public listing is missing from sitemap.xml',
  );

  await new Promise((resolve, reject) => {
    gateway.close((error) => (error ? reject(error) : resolve()));
  });

  const unavailable = await fetchHtml('/annonces/gateway-down-seo-smoke');
  assert(
    unavailable.response.status === 200,
    `Gateway outage must not become a false 404; got HTTP ${unavailable.response.status}`,
  );

  console.log(
    'SEO runtime smoke: PASS — metadata, sitemap, true 404 and Gateway outage fallback verified.',
  );
} finally {
  if (gateway.listening) {
    await new Promise((resolve) => gateway.close(() => resolve()));
  }

  if (web.exitCode === null) {
    signalWebTree('SIGTERM');
    await Promise.race([
      once(web, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }

  if (web.exitCode === null) {
    signalWebTree('SIGKILL');
    await Promise.race([
      once(web, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }

  // Descendants can inherit pnpm's pipes even after the parent exits.
  // Destroy them explicitly so this smoke test never keeps the runner alive.
  web.stdout.destroy();
  web.stderr.destroy();
}
