#!/usr/bin/env node
// LOT 9B-F part A: publish real five-photo donations/trades through Gateway
// and MinIO on disposable CI Compose. NOT the final browser form certification.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';

assert.equal(process.env.COMPOSE_PROJECT_NAME, 'projet-indiv26-m6-ci',
  'Never run the media test outside disposable CI Compose');
assert.equal(process.env.M8_RUN_INTEGRATION, 'true');
assert.equal(process.env.LOT9BF_RUN_MEDIA, 'true');

const gateway = 'http://127.0.0.1:' + (process.env.GATEWAY_HOST_PORT ?? '13000');
const keycloak = process.env.KEYCLOAK_PUBLIC_URL ?? 'http://localhost:18081';
const wishes = ['Roman', 'Jeu de société', 'Échiquier', 'Album', 'Sac'];
const imageHeader = Buffer.from('89504e470d0a1a0a', 'hex');
let listingSerial = 0;

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const bytes = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1)
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, bytes, checksum]);
}

function picture(color) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header[8] = 8;
  header[9] = 6;
  const row = Buffer.alloc(1 + 16 * 4);
  for (let x = 0; x < 16; x++) {
    const offset = 1 + x * 4;
    row[offset] = color;
    row[offset + 1] = (color + x * 19) % 256;
    row[offset + 2] = 255 - color;
    row[offset + 3] = 255;
  }
  return Buffer.concat([imageHeader, chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0))]);
}

async function http(path, { auth, method = 'GET', body, status = 200, binary = false } = {}) {
  const headers = {};
  if (auth) headers.authorization = 'Bearer ' + auth;
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(gateway + path, {
    method, headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const content = binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
  assert.equal(response.status, status,
    method + ' ' + path + ' returned ' + response.status + ': ' +
    (binary ? '[binary]' : content.slice(0, 320)));
  return binary ? { bytes: content, headers: response.headers } : (content ? JSON.parse(content) : null);
}

async function login(username) {
  const res = await fetch(keycloak + '/realms/projet-indiv26/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'cli',
      username, password: username + '-local',
    }),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(res.status, 200, 'Demo Keycloak login for ' + username);
  return (await res.json()).access_token;
}

async function checkListing(label, type, owner, moderator, unprivileged, imageIntruder, pendingNonOwner) {
  const listingNumber = ++listingSerial;
  const body = {
    title: '9BF ' + label + ' ' + randomUUID(),
    description: 'Annonce enrichie de démonstration, entièrement jetable dans GitHub Actions.',
    operationType: type, tradeWishes: type === 'TRADE' ? wishes : [],
  };
  const created = await http('/api/listings', { method: 'POST', auth: owner, status: 201, body });
  assert.equal(created.status, 'PENDING');
  assert.equal(created.images.length, 0);
  await http('/api/listings/' + created.id, { status: 404 });

  // An unfinished listing cannot be approved, regardless of the creator's role.
  await http('/api/moderation/listings/' + created.id + '/approve', {
    method: 'POST', auth: moderator, status: 400,
    body: { reviewedUpdatedAt: created.updatedAt },
  });
  await http('/api/moderation/listings/' + created.id + '/approve', {
    method: 'POST', auth: unprivileged, status: 403,
    body: { reviewedUpdatedAt: created.updatedAt },
  });

  // A unique pixel payload for EACH of the fifteen files catches MinIO object-key
  // collisions across listings as well as collisions across image positions.
  const assets = Array.from({ length: 5 }, (_, i) =>
    picture(17 + 39 * i + 7 * listingNumber));
  const makeForm = () => {
    const data = new FormData();
    assets.forEach((png, i) => data.append('images',
      new Blob([png], { type: 'image/png' }), 'certification-' + (i + 1) + '.png'));
    return data;
  };
  await http('/api/listings/' + created.id + '/images', {
    method: 'PUT', auth: imageIntruder, status: 403, body: makeForm(),
  });
  const saved = await http('/api/listings/' + created.id + '/images', {
    method: 'PUT', auth: owner, body: makeForm(),
  });
  assert.equal(saved.length, 5, 'Exactly five uploaded images');
  assert.deepEqual(saved.map(x => x.position), [0, 1, 2, 3, 4]);
  const owned = await http('/api/listings/me', { auth: owner });
  const pending = owned.find(x => x.id === created.id);
  assert.ok(pending && pending.images.length === 5);

  const queue = await http('/api/moderation/listings?status=PENDING', { auth: moderator });
  const queued = queue.find(x => x.id === created.id);
  assert.ok(queued && queued.images.length === 5,
    'Moderator should see five images in pending listing');
  assert.equal(queued.updatedAt, pending.updatedAt,
    'Moderation queue must expose fresh listing updatedAt');

  // The public media endpoints must not reveal a PENDING listing, but
  // ModerationGallery must be able to read the actual private MinIO bytes.
  await http('/api/listings/' + created.id + '/images', { status: 404 });
  for (const [i, image] of queued.images.entries()) {
    const prefix = '/api/listings/' + created.id + '/images/' + image.id + '/content';
    await http(prefix, { status: 404 });
    await http(prefix + '/authorized', { status: 401 });
    if (pendingNonOwner) {
      await http(prefix + '/authorized', { auth: pendingNonOwner, status: 403 });
    }
    const privateImage = await http(prefix + '/authorized', {
      auth: moderator, binary: true,
    });
    assert.deepEqual(privateImage.bytes, assets[i],
      'ModerationGallery must show the original bytes before approval');
    const ownerImage = await http(prefix + '/authorized', { auth: owner, binary: true });
    assert.deepEqual(ownerImage.bytes, assets[i], 'Owner must also read own pending photos');
  }

  const approved = await http('/api/moderation/listings/' + created.id + '/approve', {
    method: 'POST', auth: moderator,
    body: { reviewedUpdatedAt: queued.updatedAt },
  });
  assert.equal(approved.status, 'APPROVED');

  const publicListing = await http('/api/listings/' + created.id);
  assert.equal(publicListing.images.length, 5);
  assert.deepEqual(publicListing.tradeWishes.map(x => x.label),
    type === 'TRADE' ? wishes : [],
    'Catalog must persist all five original distinct wishes, in order');
  for (const [i, image] of publicListing.images.entries()) {
    assert.equal(image.mimeType, 'image/png');
    const served = await http('/api/listings/' + created.id + '/images/' + image.id + '/content',
      { binary: true });
    assert.equal(served.headers.get('content-type')?.split(';')[0], 'image/png');
    assert.deepEqual(served.bytes, assets[i], 'Original bytes must survive Gateway + MinIO');
  }
  console.log('[LOT9B-F] ' + label + ': 5 real PNGs + MinIO + moderation + public catalog: PASS');
  return created.id;
}

async function run() {
  const moderator = await login('demo-moderator');
  const requester = await login('demo-user');
  // Moderator's listings: an ordinary user is unauthorized to moderate, upload,
  // or read their private images. Requester's listing: the MODERATOR is forbidden
  // to replace another user's images, even with elevated privileges.
  const don = await checkListing('DON', 'DONATION',
    moderator, moderator, requester, requester, requester);
  const troc = await checkListing('TROC', 'TRADE',
    moderator, moderator, requester, requester, requester);
  const offer = await checkListing('OFFER', 'TRADE',
    requester, moderator, requester, moderator, null);
  const publicListings = await http('/api/listings');
  for (const id of [don, troc, offer]) {
    assert.ok(publicListings.some(x => x.id === id && x.images.length === 5),
      'All three real enriched listings must be public');
  }
  console.log('[LOT9B-F] PART A: 3 enriched listings, 15 PNGs, 5 trade wishes, RBAC: PASS');
  console.log('[LOT9B-F] Full Chrome create/upload/moderate workflow remains to certify');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
