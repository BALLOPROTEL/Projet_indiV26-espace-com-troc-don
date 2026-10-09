#!/usr/bin/env node
// M9 first live acceptance: received owner inbox + conditional refusal + events.
// Must run ONLY on the disposable Compose stack prepared by M8-B/C.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci');
assert.equal(process.env.M8_RUN_INTEGRATION, 'true');
const gateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');
const notification = 'http://127.0.0.1:' + (process.env.NOTIFICATION_HOST_PORT ?? '13103');
const keycloak = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:18081';
const id = 'm9-don-' + randomUUID();

async function call(base, path, { expected = 200, ...options } = {}) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(12000) });
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  assert.equal(response.status, expected, `${options.method ?? 'GET'} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(value).slice(0, 360)}`);
  return value;
}

async function keycloakToken(username) {
  const result = await call(keycloak, '/realms/projet-indiv26/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'cli', username, password: username + '-local' }),
  });
  const payload = JSON.parse(Buffer.from(result.access_token.split('.')[1], 'base64url'));
  return { value: result.access_token, sub: payload.sub };
}
const auth = user => ({ authorization: 'Bearer ' + user.value });

function seed(owner) {
  const code = `const {PrismaClient}=require('./generated/prisma');(async()=>{const p=new PrismaClient();try{await p.listing.create({data:{id:process.env.M9_LISTING_ID,ownerId:process.env.M9_OWNER,title:'M9 live donation refusal',description:'Disposable approved donation for M9 real workflow acceptance.',operationType:'DONATION',status:'APPROVED',availabilityStatus:'AVAILABLE'}})}finally{await p.$disconnect()}})().catch(e=>{console.error(e);process.exit(1)})`;
  execFileSync('docker', ['compose', '-f', 'compose.yaml', 'exec', '-T', '-e', 'M9_OWNER=' + owner.sub,
    '-e', 'M9_LISTING_ID=' + id, 'catalog-service', 'node', '-'],
  { input: code, stdio: ['pipe', 'pipe', 'inherit'], timeout: 60000 });
}

async function main() {
  const owner = await keycloakToken('demo-moderator');
  const requester = await keycloakToken('demo-user');
  const stranger = await keycloakToken('demo-admin');
  seed(owner);

  const target = await call(gateway, '/api/listings/' + id);
  assert.equal(target.ownerId, owner.sub);

  // Browser visual smoke runs before disposable Compose cleanup; only a
  // synthetic, public listing identifier is persisted to disk.
  mkdirSync('.m6-smoke', { recursive: true });
  writeFileSync('.m6-smoke/m9-browser-listing-id', id + '\\n');

  await call(gateway, '/api/proposals/received', { expected: 401 });
  const created = await call(gateway, '/api/proposals', {
    method: 'POST', expected: 201,
    headers: { ...auth(requester), 'content-type': 'application/json' },
    body: JSON.stringify({ targetListingId: id, type: 'DONATION_REQUEST', message: 'Merci pour votre don.' }),
  });
  assert.equal(created.status, 'PENDING');

  const received = await call(gateway, '/api/proposals/received', { headers: auth(owner) });
  assert.ok(received.some(item => item.id === created.id), 'Owner must receive this proposal');
  const unauthorizedInbox = await call(gateway, '/api/proposals/received', { headers: auth(stranger) });
  assert.ok(!unauthorizedInbox.some(item => item.id === created.id), 'Other user must not receive proposal');
  const sent = await call(gateway, '/api/proposals/me', { headers: auth(requester) });
  assert.ok(sent.some(item => item.id === created.id), 'Requester must see their sent proposal');
  console.log('[M9] Owner-only received inbox + sender tracking: PASS');

  await call(gateway, '/api/proposals/' + created.id + '/reject', {
    method: 'POST', expected: 403, headers: auth(stranger),
  });
  const rejected = await call(gateway, '/api/proposals/' + created.id + '/reject', {
    method: 'POST', expected: 201, headers: auth(owner),
  });
  assert.equal(rejected.status, 'REJECTED');
  assert.ok(rejected.resolvedAt);

  await call(gateway, '/api/proposals/' + created.id + '/reject', {
    method: 'POST', expected: 409, headers: auth(owner),
  });
  await call(gateway, '/api/proposals/' + created.id + '/accept', {
    method: 'POST', expected: 409, headers: auth(owner),
  });
  const after = await call(gateway, '/api/listings/' + id);
  assert.equal(after.availabilityStatus, 'AVAILABLE');
  console.log('[M9] Owner rejection, atomic 409, no Catalog reservation: PASS');

  let matches = [];
  for (let i = 0; i < 35; i++) {
    const entries = await call(notification, '/notifications/recent');
    matches = entries.filter(entry => entry.event?.type === 'proposal.rejected' && entry.event?.data?.proposalId === created.id);
    if (matches.length) break;
    await delay(300);
  }
  assert.equal(matches.length, 1, 'Exactly one rejected event must be delivered');
  assert.equal(matches[0].event.data.ownerId, owner.sub);
  assert.equal(matches[0].event.version, 1);
  console.log('[M9] RabbitMQ proposal.rejected emitted and stored once: PASS');
  console.log('[M9] DON/TROC owner workflow acceptance: PASS');
}

main().catch(error => { console.error('[M9 FAIL]', error); process.exitCode = 1; });
