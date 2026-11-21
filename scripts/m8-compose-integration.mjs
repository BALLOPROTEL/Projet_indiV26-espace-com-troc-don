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
const productSuffix = randomUUID().slice(0, 8);
const productSlug = 'm8-product-' + productSuffix;
const productSku = 'M8-' + productSuffix.toUpperCase();

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
  const admin = await token('demo-admin');
  assert.equal(new Set([
    requester.subject,
    owner.subject,
    admin.subject,
  ]).size, 3);

  await request(gateway, '/api/health/ready', {}, 200);
  await request(gateway, '/api/proposals/me', {}, 401);
  await request(gateway, '/api/auth/protected', {}, 401);
  await request(gateway, '/api/internal/listings/unreachable', {}, 404);
  await request(gateway, '/api/notifications/recent', {}, 404);
  await request(gateway, '/api/notifications/me', {}, 401);
  info('Gateway paths, legacy fallback, protected and private routes: PASS');

  await request(gateway, '/api/admin/products', {}, 401);
  await request(gateway, '/api/admin/products', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      slug: productSlug,
      name: 'M8 disposable commercial product',
      description:
        'Synthetic product created only inside the isolated M8 integration environment.',
      category: 'M8 Tests',
      variants: [{
        sku: productSku,
        label: 'Standard',
        priceCents: 2599,
        stock: 3,
      }],
    }),
  }, 403);

  const draftProduct = await request(gateway, '/api/admin/products', {
    method: 'POST',
    headers: {
      ...auth(admin),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      slug: productSlug,
      name: 'M8 disposable commercial product',
      description:
        'Synthetic product created only inside the isolated M8 integration environment.',
      category: 'M8 Tests',
      variants: [{
        sku: productSku,
        label: 'Standard',
        priceCents: 2599,
        stock: 3,
      }],
    }),
  }, 201);
  assert.equal(draftProduct.status, 'DRAFT');
  assert.equal(draftProduct.variants[0].priceCents, 2599);
  assert.equal(draftProduct.variants[0].stock, 3);

  await request(gateway, '/api/products/' + productSlug, {}, 404);
  await request(
    gateway,
    '/api/admin/products/' + draftProduct.id + '/publish',
    {
      method: 'POST',
      headers: auth(admin),
    },
    409,
  );

  const productImageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9ZVQAAAAASUVORK5CYII=',
    'base64',
  );
  const productImagesBody = new FormData();
  productImagesBody.append(
    'images',
    new Blob([productImageBytes], { type: 'image/png' }),
    'm8-product.png',
  );
  const uploadedProductImages = await request(
    gateway,
    '/api/admin/products/' + draftProduct.id + '/images',
    {
      method: 'PUT',
      headers: auth(admin),
      body: productImagesBody,
    },
    200,
  );
  assert.equal(uploadedProductImages.length, 1);
  assert.equal(uploadedProductImages[0].mimeType, 'image/png');

  const publishedProduct = await request(
    gateway,
    '/api/admin/products/' + draftProduct.id + '/publish',
    {
      method: 'POST',
      headers: auth(admin),
    },
    200,
  );
  assert.equal(publishedProduct.status, 'PUBLISHED');

  const publicProduct = await request(
    gateway,
    '/api/products/' + productSlug,
    {},
    200,
  );
  assert.equal(publicProduct.slug, productSlug);
  assert.equal(publicProduct.fromPriceCents, 2599);
  assert.equal(publicProduct.availableStock, 3);
  assert.equal(publicProduct.images.length, 1);
  assert.equal('status' in publicProduct, false);

  const publicImageResponse = await fetch(
    new URL(publicProduct.images[0].contentUrl, gateway),
    { signal: AbortSignal.timeout(12000) },
  );
  assert.equal(publicImageResponse.status, 200);
  assert.equal(
    publicImageResponse.headers.get('content-type'),
    'image/png',
  );
  assert.ok((await publicImageResponse.arrayBuffer()).byteLength > 0);

  const searchedProducts = await request(
    gateway,
    '/api/products?category=' + encodeURIComponent('M8 Tests'),
    {},
    200,
  );
  assert.ok(searchedProducts.some(item => item.id === draftProduct.id));

  await request(gateway, '/api/cart', {}, 401);
  const emptyCart = await request(gateway, '/api/cart', {
    headers: auth(requester),
  }, 200);
  assert.deepEqual(emptyCart.items, []);
  assert.equal(emptyCart.subtotalCents, 0);

  await request(gateway, '/api/cart/items', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      productId: draftProduct.id,
      variantId: publicProduct.variants[0].id,
      quantity: 1,
      priceCents: 1,
    }),
  }, 400);

  await request(gateway, '/api/cart/items', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      productId: draftProduct.id,
      variantId: publicProduct.variants[0].id,
      quantity: 4,
    }),
  }, 409);

  const addedCart = await request(gateway, '/api/cart/items', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      productId: draftProduct.id,
      variantId: publicProduct.variants[0].id,
      quantity: 2,
    }),
  }, 201);
  assert.equal(addedCart.items.length, 1);
  assert.equal(addedCart.items[0].unitPriceCents, 2599);
  assert.equal(addedCart.items[0].lineTotalCents, 5198);
  assert.equal(addedCart.subtotalCents, 5198);

  const secondUserCart = await request(gateway, '/api/cart', {
    headers: auth(owner),
  }, 200);
  assert.deepEqual(secondUserCart.items, []);

  const productAfterCart = await request(
    gateway,
    '/api/products/' + productSlug,
    {},
    200,
  );
  assert.equal(
    productAfterCart.variants[0].stock,
    3,
    'Cart must not reserve product stock',
  );

  const quantityCart = await request(
    gateway,
    '/api/cart/items/' + publicProduct.variants[0].id,
    {
      method: 'PATCH',
      headers: {
        ...auth(requester),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ quantity: 3 }),
    },
    200,
  );
  assert.equal(quantityCart.subtotalCents, 7797);

  await request(
    gateway,
    '/api/admin/products/' + draftProduct.id +
      '/variants/' + publicProduct.variants[0].id,
    {
      method: 'PATCH',
      headers: {
        ...auth(admin),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        priceCents: 2999,
        stock: 5,
      }),
    },
    200,
  );

  const repricedCart = await request(gateway, '/api/cart', {
    headers: auth(requester),
  }, 200);
  assert.equal(repricedCart.items[0].unitPriceCents, 2999);
  assert.equal(repricedCart.items[0].stock, 5);
  assert.equal(repricedCart.subtotalCents, 8997);

  await request(gateway, '/api/orders', {}, 401);
  await request(gateway, '/api/orders', {
    method: 'POST',
    headers: {
      ...auth(owner),
      'content-type': 'application/json',
      'idempotency-key': 'm8-owner-empty-' + productSuffix,
    },
    body: JSON.stringify({
      recipientFirstName: 'Owner',
      recipientLastName: 'Empty',
      email: 'owner@example.test',
      addressLine1: '1 rue du Test',
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',
    }),
  }, 400);

  const orderIdempotencyKey = 'm8-order-' + productSuffix;
  const orderInput = {
    recipientFirstName: 'Demo',
    recipientLastName: 'User',
    email: 'demo-user@example.test',
    addressLine1: '1 rue du Commerce',
    postalCode: '75001',
    city: 'Paris',
    countryCode: 'FR',
  };

  const draftOrder = await request(gateway, '/api/orders', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
      'idempotency-key': orderIdempotencyKey,
    },
    body: JSON.stringify(orderInput),
  }, 201);
  assert.equal(draftOrder.status, 'DRAFT');
  assert.equal(draftOrder.subtotalCents, 8997);
  assert.equal(draftOrder.items.length, 1);
  assert.equal(draftOrder.items[0].unitPriceCents, 2999);
  assert.equal(draftOrder.items[0].quantity, 3);
  assert.equal(draftOrder.items[0].lineTotalCents, 8997);

  const replayedOrder = await request(gateway, '/api/orders', {
    method: 'POST',
    headers: {
      ...auth(requester),
      'content-type': 'application/json',
      'idempotency-key': orderIdempotencyKey,
    },
    body: JSON.stringify(orderInput),
  }, 201);
  assert.equal(replayedOrder.id, draftOrder.id);

  await request(gateway, '/api/orders/' + draftOrder.id, {
    headers: auth(owner),
  }, 404);

  const requesterOrders = await request(gateway, '/api/orders', {
    headers: auth(requester),
  }, 200);
  assert.ok(requesterOrders.some(order => order.id === draftOrder.id));

  await request(
    gateway,
    '/api/admin/products/' + draftProduct.id +
      '/variants/' + publicProduct.variants[0].id,
    {
      method: 'PATCH',
      headers: {
        ...auth(admin),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        priceCents: 3499,
        stock: 5,
      }),
    },
    200,
  );

  const frozenOrder = await request(
    gateway,
    '/api/orders/' + draftOrder.id,
    { headers: auth(requester) },
    200,
  );
  assert.equal(frozenOrder.items[0].unitPriceCents, 2999);
  assert.equal(frozenOrder.subtotalCents, 8997);

  const cartAfterOrder = await request(gateway, '/api/cart', {
    headers: auth(requester),
  }, 200);
  assert.equal(cartAfterOrder.items[0].unitPriceCents, 3499);
  assert.equal(cartAfterOrder.items[0].stock, 5);
  assert.equal(cartAfterOrder.items[0].quantity, 3);
  assert.equal(cartAfterOrder.subtotalCents, 10497);

  const productAfterOrder = await request(
    gateway,
    '/api/products/' + productSlug,
    {},
    200,
  );
  assert.equal(
    productAfterOrder.variants[0].stock,
    5,
    'L5B order draft must not reserve or decrement product stock',
  );
  info('Commerce Order drafts: JWT isolation + idempotency + frozen price snapshot + no reservation: PASS');

  await request(
    gateway,
    '/api/admin/products/' + draftProduct.id + '/archive',
    {
      method: 'POST',
      headers: auth(admin),
    },
    200,
  );
  await request(gateway, '/api/products/' + productSlug, {}, 404);

  const archivedCart = await request(gateway, '/api/cart', {
    headers: auth(requester),
  }, 200);
  assert.equal(archivedCart.hasUnavailableItems, true);
  assert.equal(
    archivedCart.items[0].unavailableReason,
    'PRODUCT_NOT_PUBLISHED',
  );
  assert.equal(archivedCart.subtotalCents, 0);

  const clearedCart = await request(
    gateway,
    '/api/cart/items/' + publicProduct.variants[0].id,
    {
      method: 'DELETE',
      headers: auth(requester),
    },
    200,
  );
  assert.deepEqual(clearedCart.items, []);
  info('Commerce Cart: JWT isolation + server price/stock + no reservation: PASS');
  info('Commercial Product: ADMIN RBAC + DRAFT/PUBLISHED/ARCHIVED visibility: PASS');

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

  await request(gateway, '/api/favorites/' + listingId, {}, 401);
  const favorite = await request(gateway, '/api/favorites/' + listingId, {
    method: 'POST',
    headers: auth(requester),
  }, 201);
  assert.equal(favorite.listingId, listingId);
  assert.equal(favorite.favorited, true);
  const favoriteState = await request(gateway, '/api/favorites/' + listingId, {
    headers: auth(requester),
  }, 200);
  assert.equal(favoriteState.favorited, true);
  const favorites = await request(gateway, '/api/favorites', {
    headers: auth(requester),
  }, 200);
  assert.ok(favorites.some(item => item.id === listingId));
  const removedFavorite = await request(gateway, '/api/favorites/' + listingId, {
    method: 'DELETE',
    headers: auth(requester),
  }, 200);
  assert.equal(removedFavorite.favorited, false);
  info('Catalog favorites: JWT add/read/list/remove real persistence: PASS');

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

  const ownerInbox = await request(gateway, '/api/notifications/me', {
    headers: auth(owner),
  }, 200);
  const requesterInbox = await request(gateway, '/api/notifications/me', {
    headers: auth(requester),
  }, 200);
  const ownerTypes = new Set(
    ownerInbox
      .filter(item => item.event?.data?.targetListingId === listingId)
      .map(item => item.event.type),
  );
  const requesterTypes = new Set(
    requesterInbox
      .filter(item => item.event?.data?.targetListingId === listingId)
      .map(item => item.event.type),
  );
  assert.deepEqual(
    ownerTypes,
    new Set(['proposal.created', 'transaction.completed']),
    'Owner inbox must contain only owner-targeted events',
  );
  assert.deepEqual(
    requesterTypes,
    new Set(['proposal.accepted', 'transaction.completed']),
    'Requester inbox must contain only requester-targeted events',
  );
  info('Gateway -> Notification JWT user inbox isolation: PASS');
  info('Marketplace -> RabbitMQ -> Notification real event delivery: PASS (' + events.length + ' unique events)');
  info('M8-B integration: PASS');
}

run().catch(error => {
  console.error('[M8-B FAIL]', error);
  process.exitCode = 1;
});
