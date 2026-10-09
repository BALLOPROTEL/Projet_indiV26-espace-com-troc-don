#!/usr/bin/env node
// M8-C E2E TROC + authorization + RabbitMQ duplicate/durable replay + recovery.
// Reuses the disposable Compose environment prepared by m6-compose-smoke.sh.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci',
  'Refusing M8-C against a non-isolated Compose project');
assert.equal(process.env.M8_RUN_INTEGRATION, 'true',
  'M8-C requires the disposable, health-checked M8-B integration stack');

const gateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');
const catalog = 'http://127.0.0.1:' + (process.env.CATALOG_HOST_PORT ?? '13101');
const notification = 'http://127.0.0.1:' + (process.env.NOTIFICATION_HOST_PORT ?? '13103');
const keycloak = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:18081';
const rabbitManagement = 'http://127.0.0.1:' + (process.env.RABBITMQ_MANAGEMENT_HOST_PORT ?? '15682');
const internalToken = 'local_internal_change_me_2026_very_long_token';
const tradeTarget = 'm8-trade-target-' + randomUUID();
const tradeOffer = 'm8-trade-offer-' + randomUUID();
const recoveryTarget = 'm8-recovery-' + randomUUID();

const say = value => console.log('[M8-C] ' + value);
function compose(...args) {
  return execFileSync('docker', ['compose', '-f', 'compose.yaml', ...args], {
    encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
}
async function call(base, route, { expected = 200, ...opts } = {}) {
  const result = await fetch(new URL(route, base), {
    ...opts, signal: AbortSignal.timeout(12_000),
  });
  const raw = await result.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  assert.equal(result.status, expected,
    (opts.method ?? 'GET') + ' ' + route + ': HTTP ' + result.status +
    ', expected ' + expected + ': ' + JSON.stringify(data).slice(0, 320));
  return data;
}
const internal = () => ({ 'x-internal-service-token': internalToken });
const jwtHeader = jwt => ({ authorization: 'Bearer ' + jwt.value });
const jsonHeaders = jwt => ({ ...jwtHeader(jwt), 'content-type': 'application/json' });
async function token(username) {
  const data = await call(keycloak, '/realms/projet-indiv26/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'cli',
      username, password: username + '-local' }),
  });
  const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url'));
  assert.equal(payload.iss, keycloak + '/realms/projet-indiv26');
  assert.ok([payload.aud].flat().includes('api'));
  return { value: data.access_token, sub: payload.sub };
}
async function poll(label, action, maxAttempts = 35) {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const answer = await action();
      if (answer !== false) return answer;
    } catch (error) { lastError = error; }
    await delay(400);
  }
  throw new Error('Timeout waiting for ' + label + ': ' + (lastError?.message ?? 'not ready'));
}

const seedSource = `
const { PrismaClient } = require('./generated/prisma');
(async () => {
  const prisma = new PrismaClient();
  try {
    for (const [id, ownerId, operationType] of [
      [process.env.M8_TARGET, process.env.M8_OWNER, 'TRADE'],
      [process.env.M8_OFFER, process.env.M8_REQUESTER, 'TRADE'],
      [process.env.M8_RECOVERY, process.env.M8_OWNER, 'DONATION'],
    ]) {
      await prisma.listing.create({
        data: { id, ownerId, operationType, title: 'M8-C E2E disposable listing',
          description: 'Trade and recovery integration checks against disposable Catalog PostgreSQL.',
          status: 'APPROVED', availabilityStatus: 'AVAILABLE' },
      });
    }
  } finally { await prisma.$disconnect(); }
})().catch(error => { console.error(error); process.exit(1); });
`;
function seed(owner, requester) {
  execFileSync('docker', [
    'compose', '-f', 'compose.yaml', 'exec', '-T',
    '-e', 'M8_TARGET=' + tradeTarget, '-e', 'M8_OFFER=' + tradeOffer,
    '-e', 'M8_RECOVERY=' + recoveryTarget,
    '-e', 'M8_OWNER=' + owner.sub,
    '-e', 'M8_REQUESTER=' + requester.sub,
    'catalog-service', 'node', '-',
  ], { input: seedSource, stdio: ['pipe', 'pipe', 'inherit'], timeout: 60_000 });
}

function requestTrade(requester, targetListingId, offeredListingId) {
  return call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(requester),
    body: JSON.stringify({ targetListingId, offeredListingId, type: 'TRADE_OFFER' }),
    expected: 201,
  });
}

async function listingState(id) {
  return call(catalog, '/internal/listings/' + id, { headers: internal() });
}
async function recent() {
  const data = await call(notification, '/notifications/recent');
  assert.ok(Array.isArray(data));
  return data;
}
async function waitForEvent(id) {
  return poll('event ' + id, async () => {
    const items = (await recent()).filter(item => item.event?.eventId === id);
    return items.length ? items : false;
  });
}

async function publish(event) {
  const response = await call(
    rabbitManagement, '/api/exchanges/%2F/marketplace.events/publish', {
      expected: 200,
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(
          'app:rabbitmq_local_change_me_2026').toString('base64'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        properties: { delivery_mode: 2, content_type: 'application/json', message_id: event.eventId },
        routing_key: event.type,
        payload: JSON.stringify(event),
        payload_encoding: 'string',
      }),
    },
  );
  assert.equal(response.routed, true, 'RabbitMQ must route the durable message to Notification');
}

async function run() {
  const requester = await token('demo-user');
  const owner = await token('demo-moderator');
  const other = await token('demo-admin');
  assert.equal(new Set([owner.sub, requester.sub, other.sub]).size, 3);
  seed(owner, requester);

  // Authentication + ownership, including a real 3rd-party JWT (not mocks).
  await call(gateway, '/api/proposals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetListingId: tradeTarget, offeredListingId: tradeOffer, type: 'TRADE_OFFER' }),
    expected: 401,
  });
  await call(gateway, '/api/transactions/me', { expected: 401 });
  await call(gateway, '/api/transactions/me', {
    headers: { authorization: 'Bearer invalid.jwt.value' }, expected: 401,
  });
  await call(catalog, '/internal/listings/' + tradeTarget, {
    headers: { 'x-internal-service-token': 'wrong' }, expected: 401,
  });
  await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(owner),
    body: JSON.stringify({ targetListingId: tradeTarget, type: 'DONATION_REQUEST' }), expected: 403,
  });
  await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(requester),
    body: JSON.stringify({ targetListingId: tradeTarget, type: 'DONATION_REQUEST' }), expected: 400,
  });
  await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(requester),
    body: JSON.stringify({ targetListingId: tradeTarget, offeredListingId: tradeTarget, type: 'TRADE_OFFER' }),
    expected: 400,
  });
  await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(other),
    body: JSON.stringify({ targetListingId: tradeTarget, offeredListingId: tradeOffer, type: 'TRADE_OFFER' }),
    expected: 403,
  });
  say('Real Keycloak JWT + invalid/unauthenticated + ownership 400/401/403: PASS');

  const proposal = await requestTrade(requester, tradeTarget, tradeOffer);
  assert.equal(proposal.type, 'TRADE_OFFER');
  assert.equal(proposal.status, 'PENDING');
  assert.equal(proposal.requesterId, requester.sub);
  await call(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: jwtHeader(other), expected: 403,
  });
  await call(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: jwtHeader(requester), expected: 403,
  });
  const transaction = await call(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: jwtHeader(owner), expected: 201,
  });
  assert.equal(transaction.ownerId, owner.sub);
  assert.equal(transaction.requesterId, requester.sub);
  assert.equal(transaction.status, 'IN_PROGRESS');
  assert.equal((await listingState(tradeTarget)).availabilityStatus, 'RESERVED');
  assert.equal((await listingState(tradeOffer)).availabilityStatus, 'RESERVED');
  await call(gateway, '/api/proposals/' + proposal.id + '/accept', {
    method: 'POST', headers: jwtHeader(owner), expected: 409,
  });
  await call(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: jwtHeader(other), expected: 403,
  });
  const first = await call(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: jwtHeader(requester), expected: 201,
  });
  assert.equal(first.status, 'IN_PROGRESS');
  const second = await call(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: jwtHeader(owner), expected: 201,
  });
  assert.equal(second.status, 'COMPLETED');
  assert.equal((await listingState(tradeTarget)).availabilityStatus, 'COMPLETED');
  assert.equal((await listingState(tradeOffer)).availabilityStatus, 'COMPLETED');
  await call(gateway, '/api/transactions/' + transaction.id + '/confirm', {
    method: 'POST', headers: jwtHeader(owner), expected: 409,
  });
  say('Real TROC E2E: 2 owners / 2 reserved listings / 2 confirmations / COMPLETED / replay 409: PASS');

  const events = await poll('three TROC RabbitMQ events', async () => {
    const entries = (await recent()).filter(item => item.event?.data?.targetListingId === tradeTarget);
    return new Set(entries.map(item => item.event?.type)).size === 3 ? entries : false;
  });
  assert.deepEqual(
    new Set(events.map(item => item.event.type)),
    new Set(['proposal.created', 'proposal.accepted', 'transaction.completed']),
  );
  assert.equal(new Set(events.map(item => item.event.eventId)).size, 3);
  say('TROC RabbitMQ 3 unique actual notifications: PASS');

  // Real duplicate delivery to the same queue while Notification is alive.
  const duplicateEvent = {
    ...events.find(item => item.event.type === 'proposal.created').event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
  await publish(duplicateEvent);
  await publish(duplicateEvent);
  await waitForEvent(duplicateEvent.eventId);
  await delay(700);
  assert.equal((await recent()).filter(item => item.event?.eventId === duplicateEvent.eventId).length, 1,
    'Notification must not display an event twice while in one process');
  say('RabbitMQ real duplicate eventId published twice -> Notification records once: PASS');

  // Stop consumer, enqueue a persistent message, restart consumer, require delivery.
  const recoveryEvent = {
    ...duplicateEvent,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    data: { ...duplicateEvent.data, targetListingId: recoveryTarget },
  };
  compose('stop', 'notification-service');
  await publish(recoveryEvent);
  compose('start', 'notification-service');
  await poll('Notification health after restart', async () => {
    const r = await fetch(notification + '/health/ready', { signal: AbortSignal.timeout(2000) });
    return r.ok;
  }, 50);
  await waitForEvent(recoveryEvent.eventId);
  assert.equal((await recent()).filter(item => item.event?.eventId === recoveryEvent.eventId).length, 1);
  say('Notification outage + queued persistent RabbitMQ message + recovery: PASS');

  // Real synchronous dependency failure must not accept a phantom proposal.
  compose('stop', 'catalog-service');
  await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(requester),
    body: JSON.stringify({ targetListingId: recoveryTarget, type: 'DONATION_REQUEST' }),
    expected: 502,
  });
  compose('start', 'catalog-service');
  await poll('Catalog ready after restart', async () => {
    const r = await fetch(catalog + '/health/ready', { signal: AbortSignal.timeout(2000) });
    return r.ok;
  }, 55);
  const recoveredProposal = await call(gateway, '/api/proposals', {
    method: 'POST', headers: jsonHeaders(requester),
    body: JSON.stringify({ targetListingId: recoveryTarget, type: 'DONATION_REQUEST' }),
    expected: 201,
  });
  assert.equal(recoveredProposal.targetListingId, recoveryTarget);
  say('Catalog outage -> HTTP 502; recovery -> authorized proposal succeeds: PASS');

  const beforeRestartSub = owner.sub;
  compose('restart', 'keycloak');
  await poll('Keycloak OIDC after restart', async () => {
    const r = await fetch(keycloak + '/realms/projet-indiv26/.well-known/openid-configuration', {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  }, 75);
  const ownerAfter = await token('demo-moderator');
  assert.equal(ownerAfter.sub, beforeRestartSub);
  await call(gateway, '/api/transactions/me', { headers: jwtHeader(ownerAfter) });
  say('Keycloak container restart: JWT sub and authenticated API access preserved: PASS');
  say('M8-C E2E/security/resilience: PASS (scoped to disposable Compose)');
}
run().catch(error => {
  console.error('[M8-C FAIL]', error);
  process.exitCode = 1;
});
