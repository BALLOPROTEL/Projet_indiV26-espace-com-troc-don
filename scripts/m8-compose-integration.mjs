#!/usr/bin/env node
// M8-B integration using real Compose microservices and disposable data.
// Executed ONLY from the isolated M6 Docker Compose smoke environment.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci',
  'M8 integration refuses to touch an unisolated Compose project');

const gateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');
const catalog = 'http://127.0.0.1:' + (process.env.CATALOG_HOST_PORT ?? '13101');
const notification = 'http://127.0.0.1:' + (process.env.NOTIFICATION_HOST_PORT ?? '13103');
const keycloak = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://127.0.0.1:18081';
const internalToken = 'local_internal_change_me_2026_very_long_token'; // disposable Compose only
const listingId = 'm8-' + randomUUID();
const transientId = 'm8-' + randomUUID();

function info(message) {
  process.stdout.write('[M8-B] ' + message + '\n');
}

async function request(base, route, options = {}, expected = 200) {
  const response = await fetch(new URL(route, base), {
    ...options,
    signal: AbortSignal.timeout(12000),
  });
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  assert.equal(response.status, expected,
    (options.method ?? 'GET') + ' ' + route + ' -> HTTP ' + response.status +
    ', expected ' + expected + ': ' + JSON.stringify(body).slice(0, 400));
  return body;
}

async function token(username) {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'cli',
    username,
    password: username + '-local',
  });
  const response = await request(
    keycloak, '/realms/projet-indiv26/protocol/openid-connect/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params },
    200,
  );
  assert.equal(typeof response.access_token, 'string');
  const payload = JSON.parse(Buffer.from(response.access_token.split('.')[1], 'base64url'));
  assert.equal(payload.iss, keycloak + '/realms/projet-indiv26');
  assert.ok([payload.aud].flat().includes('api'));
  assert.match(payload.sub, /^[\da-f-]{36}$/i);
  return { value: response.access_token, subject: payload.sub };
}

function auth(jwt) {
  return { authorization: 'Bearer ' + jwt.value };
}

const seedScript = `
const { PrismaClient } = require('./generated/prisma');
(async () => {
  const prisma = new PrismaClient();
  try {
    for (const id of [process.env.M8_LISTING_ID, process.env.M8_TRANSIENT_ID]) {
      await prisma.listing.create({
        data: {
          id,
          ownerId: process.env.M8_OWNER_SUB,
          title: 'M8 B internal integration test',
          description: 'Disposable approved record seeded for real microservice HTTP integration.',
          operationType: 'DONATION',
          status: 'APPROVED',
          availabilityStatus: 'AVAILABLE',
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch(e => { console.error(e); process.exit(1); });
`;

function seed(ownerSubject) {
  execFileSync('docker',
    ['compose', '-f', 'compose.yaml', 'exec', '-T',
      '-e', 'M8_LISTING_ID=' + listingId,
      '-e', 'M8_TRANSIENT_ID=' + transientId,
      '-e', 'M8_OWNER_SUB=' + ownerSubject,
      'catalog-service', 'node', '-'],
    { input: seedScript, stdio: ['pipe', 'pipe', 'inherit'], timeout: 60000 });
}

async function run() {
  const requester = await token('demo-user');
  const owner = await token('demo-moderator');
  assert.notEqual(requester.subject, owner.subject);

  await request(gateway, '/api/health/ready', {}, 200);
  await request(gateway, '/api/proposals/me', {}, 401);
  await request(gateway, '/api/auth/protected', {}, 401);
  await request(gateway, '/api/internal/listings/unreachable', {}, 404);
  await request(gateway, '/api/notifications/recent', {}, 404);
  info('Gateway paths, legacy fallback, protected and private routes: PASS');

  seed(owner.subject);
  info('Two approved donation listings seeded in isolated Catalog DB');

  const unauth = await request(catalog, '/internal/listings/' + listingId, {}, 401);
  assert.ok(unauth);
  const snapshot = await request(catalog, '/internal/listings/' + listingId, {
    headers: { 'x-internal-service-token': internalToken },
  }, 200);
  assert.equal(snapshot.ownerId, owner.subject);
  assert.equal(snapshot.status, 'APPROVED');
  await request(catalog, '/internal/listings/no-m8-such-listing', {
    headers: { 'x-internal-service-token': internalToken },
  }, 404);
  await request(catalog, '/internal/listings/' + transientId + '/complete', {
    method: 'POST',
    headers: { 'x-internal-service-token': internalToken },
  }, 409);
  const reserved = await request(catalog, '/internal/listings/' + transientId + '/reserve', {
    method: 'POST', headers: { 'x-internal-service-token': internalToken },
  }, 201);
  assert.equal(reserved.availabilityStatus, 'RESERVED');
  await request(catalog, '/internal/listings/' + transientId + '/reserve', {
    method: 'POST', headers: { 'x-internal-service-token': internalToken },
  }, 409);
  const released = await request(catalog, '/internal/listings/' + transientId + '/release', {
    method: 'POST', headers: { 'x-internal-service-token': internalToken },
  }, 201);
  assert.equal(released.availabilityStatus, 'AVAILABLE');
  info('Catalog internal service-token authorization + 404/409/reserve/release: PASS');

  const proposal = await request(gateway, '/api/proposals', {
    method: 'POST',
    headers: { ...auth(requester), 'content-type': 'application/json' },
    body: JSON.stringify({ targetListingId: listingId, type: 'DONATION_REQUEST' }),
  }, 201);
  assert.equal(proposal.targetListingId, listingId);
  assert.equal(proposal.requesterId, requester.subject);
  assert.equal(proposal.status, 'PENDING');
  info('Gateway -> Marketplace -> Catalog real donation proposal: PASS');

  await request(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: auth(requester),
  }, 403);

  const transaction = await request(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: auth(owner),
  }, 201);
  assert.equal(transaction.ownerId, owner.subject);
  assert.equal(transaction.requesterId, requester.subject);
  assert.equal(transaction.status, 'IN_PROGRESS');

  const state = await request(catalog, '/internal/listings/' + listingId, {
    headers: { 'x-internal-service-token': internalToken },
  });
  assert.equal(state.availabilityStatus, 'RESERVED');

  const ownerConfirmed = await request(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: auth(owner),
  }, 201);
  assert.equal(ownerConfirmed.status, 'IN_PROGRESS');

  const completed = await request(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: auth(requester),
  }, 201);
  assert.equal(completed.status, 'COMPLETED');

  const completeState = await request(catalog, '/internal/listings/' + listingId, {
    headers: { 'x-internal-service-token': internalToken },
  });
  assert.equal(completeState.availabilityStatus, 'COMPLETED');
  info('Marketplace -> Catalog reservation + two JWT confirmations + completion: PASS');

  const required = ['proposal.created', 'proposal.accepted', 'transaction.completed'];
  let events = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const received = await request(notification, '/notifications/recent', {}, 200);
    assert.ok(Array.isArray(received));
    events = received.filter(entry => entry.event?.data?.targetListingId === listingId);
    if (required.every(type => events.some(entry => entry.event?.type === type))) break;
    await delay(300);
  }
  assert.deepEqual(new Set(events.map(item => item.event.type)), new Set(required));
  assert.equal(new Set(events.map(item => item.event.eventId)).size, events.length,
    'Notifications must deduplicate event IDs');
  for (const item of events) {
    assert.equal(item.event.version, 1);
    assert.equal(item.event.source, 'marketplace-service');
    assert.equal(typeof item.event.eventId, 'string');
  }
  info('Marketplace -> RabbitMQ -> Notification real event delivery: PASS (' + events.length + ' unique events)');
  info('M8-B integration: PASS');
}

run().catch(error => {
  console.error('[M8-B FAIL]', error);
  process.exitCode = 1;
});
