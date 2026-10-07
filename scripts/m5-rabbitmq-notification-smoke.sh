#!/usr/bin/env bash
set -euo pipefail

logs=(
  /tmp/m5-catalog.log
  /tmp/m5-marketplace.log
  /tmp/m5-notification.log
)

cleanup() {
  for pid in     "${catalog_pid:-}"     "${marketplace_pid:-}"     "${notification_pid:-}"; do
    if [[ -n "${pid}" ]]; then
      kill -TERM -- "-${pid}" >/dev/null 2>&1 || true
      wait "${pid}" >/dev/null 2>&1 || true
    fi
  done
}

dump_logs() {
  for log in "${logs[@]}"; do
    if [[ -f "${log}" ]]; then
      echo
      echo "=== ${log} ==="
      tail -n 160 "${log}" || true
    fi
  done
}

trap cleanup EXIT

wait_for_url() {
  local name="$1"
  local url="$2"

  for attempt in $(seq 1 60); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${name}: ready"
      return 0
    fi
    sleep 1
  done

  echo "[FAIL] ${name} did not become ready: ${url}"
  dump_logs
  return 1
}

setsid bash -lc 'exec pnpm catalog:dev' > /tmp/m5-catalog.log 2>&1 &
catalog_pid=$!

setsid bash -lc 'exec pnpm marketplace-service:dev' > /tmp/m5-marketplace.log 2>&1 &
marketplace_pid=$!

setsid bash -lc 'exec pnpm notification:dev' > /tmp/m5-notification.log 2>&1 &
notification_pid=$!

wait_for_url "Catalog Service" "http://127.0.0.1:3101/health/live"
wait_for_url "Marketplace Service" "http://127.0.0.1:3102/health/ready"
wait_for_url "Notification Service" "http://127.0.0.1:3103/health/ready"

pnpm --filter catalog-service exec node - <<'NODE'
const { PrismaClient } = require('./generated/prisma');

(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.CATALOG_DATABASE_URL },
    },
  });

  try {
    await prisma.listing.deleteMany({
      where: { id: 'm5-ci-listing' },
    });

    await prisma.listing.create({
      data: {
        id: 'm5-ci-listing',
        ownerId: 'm5-ci-owner',
        title: 'M5 async smoke',
        description: 'Temporary listing for RabbitMQ notification certification.',
        operationType: 'DONATION',
        status: 'APPROVED',
        availabilityStatus: 'AVAILABLE',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

pnpm --filter marketplace-service exec node - <<'NODE'
const { ConfigService } = require('@nestjs/config');
const { PrismaService } =
  require('./dist/prisma/prisma.service.js');
const { CatalogClientService } =
  require('./dist/catalog/catalog-client.service.js');
const { MarketplaceEventPublisher } =
  require('./dist/events/event-publisher.service.js');
const { MarketplaceRulesService } =
  require('./dist/marketplace/marketplace-rules.service.js');
const { ProposalsService } =
  require('./dist/proposals/proposals.service.js');
const { TransactionsService } =
  require('./dist/transactions/transactions.service.js');

(async () => {
  const prisma = new PrismaService();
  const events = new MarketplaceEventPublisher(
    new ConfigService(process.env),
  );

  try {
    const catalog = new CatalogClientService(
      new ConfigService(process.env),
    );
    const rules = new MarketplaceRulesService();
    const proposals =
      new ProposalsService(prisma, catalog, rules, events);
    const transactions =
      new TransactionsService(prisma, catalog, rules, events);

    await events.start();
    await events.waitUntilReady(10_000);

    const old = await prisma.proposal.findMany({
      where: {
        targetListingId: 'm5-ci-listing',
      },
      select: { id: true },
    });

    if (old.length > 0) {
      await prisma.marketplaceTransaction.deleteMany({
        where: {
          proposalId: { in: old.map((item) => item.id) },
        },
      });
      await prisma.proposal.deleteMany({
        where: {
          id: { in: old.map((item) => item.id) },
        },
      });
    }

    const proposal = await proposals.create(
      'm5-ci-requester',
      {
        targetListingId: 'm5-ci-listing',
        type: 'DONATION_REQUEST',
        message: 'M5 RabbitMQ smoke',
      },
    );

    const transaction = await proposals.accept(
      proposal.id,
      'm5-ci-owner',
    );

    await transactions.confirm(
      transaction.id,
      'm5-ci-owner',
    );
    const completed = await transactions.confirm(
      transaction.id,
      'm5-ci-requester',
    );

    if (completed.status !== 'COMPLETED') {
      throw new Error('Expected M5 transaction COMPLETED');
    }

    console.log(
      JSON.stringify({
        proposalId: proposal.id,
        transactionId: transaction.id,
      }),
    );
  } finally {
    await events.onModuleDestroy();
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

for attempt in $(seq 1 40); do
  curl -fsS http://127.0.0.1:3103/notifications/recent     > /tmp/m5-notifications.json

  if node - <<'NODE'
const fs = require('node:fs');
const items = JSON.parse(
  fs.readFileSync('/tmp/m5-notifications.json', 'utf8'),
);
const types = new Set(items.map((item) => item.event?.type));
const targetSeen = items.some(
  (item) => item.event?.data?.targetListingId === 'm5-ci-listing',
);
const required = [
  'proposal.created',
  'proposal.accepted',
  'transaction.completed',
];

if (
  required.every((type) => types.has(type)) &&
  targetSeen
) {
  process.exit(0);
}

process.exit(1);
NODE
  then
    break
  fi

  if [[ "${attempt}" -eq 40 ]]; then
    echo "[FAIL] Notification Service did not consume all M5 events"
    cat /tmp/m5-notifications.json || true
    dump_logs
    exit 1
  fi

  sleep 0.25
done

node - <<'NODE'
const fs = require('node:fs');
const items = JSON.parse(
  fs.readFileSync('/tmp/m5-notifications.json', 'utf8'),
);
const selected = items
  .filter(
    (item) =>
      item.event?.data?.targetListingId === 'm5-ci-listing',
  )
  .map((item) => ({
    type: item.event.type,
    source: item.event.source,
    version: item.event.version,
  }));

console.log('M5 consumed events:', selected);
NODE

pnpm --filter marketplace-service exec node - <<'NODE'
const { PrismaClient } = require('./generated/prisma');

(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.MARKETPLACE_DATABASE_URL },
    },
  });

  try {
    const proposals = await prisma.proposal.findMany({
      where: {
        targetListingId: 'm5-ci-listing',
      },
      select: { id: true },
    });

    if (proposals.length > 0) {
      await prisma.marketplaceTransaction.deleteMany({
        where: {
          proposalId: { in: proposals.map((item) => item.id) },
        },
      });
      await prisma.proposal.deleteMany({
        where: {
          id: { in: proposals.map((item) => item.id) },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

pnpm --filter catalog-service exec node - <<'NODE'
const { PrismaClient } = require('./generated/prisma');

(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.CATALOG_DATABASE_URL },
    },
  });

  try {
    await prisma.listing.deleteMany({
      where: { id: 'm5-ci-listing' },
    });
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

echo
echo "M5 RabbitMQ -> Notification async flow: PASS"
