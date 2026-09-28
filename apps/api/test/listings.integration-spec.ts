import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { ListingsService } from '../src/listings/listings.service';
import { MarketplaceRulesService } from '../src/marketplace/marketplace-rules.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function executeSqlScript(
  prisma: PrismaService,
  sql: string,
): Promise<void> {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

describe('ListingsService PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const service = new ListingsService(
    prisma,
    new MarketplaceRulesService(),
  );
  const ownerPrefix = 'lot4-integration-';

  beforeEach(async () => {
    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: ownerPrefix,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: ownerPrefix,
        },
      },
    });
    await prisma.$disconnect();
  });

  it('persists a new listing as PENDING and returns it to its owner', async () => {
    const ownerId = `${ownerPrefix}user-1`;

    const created = await service.create(ownerId, {
      title: 'Lot de comics',
      description:
        'Lot de comics en très bon état proposé pour un échange.',
      operationType: ListingOperationType.TRADE,
      tradeWishes: [
        'Console',
        'Tablette',
        'Écran',
        'Clavier',
        'Casque',
      ],
    });

    expect(created.status).toBe(ListingStatus.PENDING);
    expect(created.availabilityStatus).toBe(
      ListingAvailabilityStatus.AVAILABLE,
    );
    expect(created.ownerId).toBe(ownerId);

    const mine = await service.findMine(ownerId);

    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe(created.id);
  });

  it('exposes a listing publicly only after approval', async () => {
    const ownerId = `${ownerPrefix}user-2`;

    const created = await service.create(ownerId, {
      title: 'DVD à donner',
      description:
        'DVD en bon état à donner à un autre membre de la communauté.',
      operationType: ListingOperationType.DONATION,
    });

    const beforeApproval = await service.findPublic();
    expect(beforeApproval.some((listing) => listing.id === created.id)).toBe(
      false,
    );

    await prisma.listingImage.createMany({
      data: Array.from({ length: 5 }, (_, position) => ({
        listingId: created.id,
        objectKey: `integration/${created.id}/${position}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 128,
        position,
      })),
    });

    const approved = await service.approve(
      created.id,
      created.updatedAt.toISOString(),
    );
    expect(approved.status).toBe(ListingStatus.APPROVED);

    const afterApproval = await service.findPublic();
    expect(afterApproval.some((listing) => listing.id === created.id)).toBe(
      true,
    );
  });

  it('requeues a legacy invalid approval through the LOT 9B-C migration', async () => {
    const ownerId = `${ownerPrefix}legacy-approved`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancienne annonce approuvée',
        description:
          'Annonce historique approuvée avant les exigences de galerie enrichie.',
        operationType: ListingOperationType.DONATION,
        status: ListingStatus.APPROVED,
      },
    });

    const migrationSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_093000_requeue_invalid_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await prisma.$executeRawUnsafe(migrationSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.PENDING);
    expect(migrated.moderationReason).toBe(
      'Publication enrichie à compléter avant republication.',
    );
  });

  it('requeues a legacy trade whose fifth wish is blank', async () => {
    const ownerId = `${ownerPrefix}legacy-trade-blank`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancien troc incomplet',
        description:
          'Ancienne annonce avec quatre souhaits réels et une ligne vide.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
        images: {
          create: Array.from({ length: 5 }, (_, position) => ({
            objectKey: `legacy/${ownerId}/${position}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 128,
            position,
          })),
        },
        tradeWishes: {
          create: ['Console', 'Tablette', 'Écran', 'Clavier', '   '].map(
            (label, position) => ({
              label,
              position,
            }),
          ),
        },
      },
    });

    const migrationSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_093000_requeue_invalid_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await prisma.$executeRawUnsafe(migrationSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.PENDING);
  });

  it('requeues a legacy trade with five valid wishes plus a dirty row', async () => {
    const ownerId = `${ownerPrefix}legacy-trade-dirty`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancien troc avec ligne sale',
        description:
          'Ancienne annonce avec cinq souhaits valides plus une ligne blanche.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
        images: {
          create: Array.from({ length: 5 }, (_, position) => ({
            objectKey: `legacy/${ownerId}/${position}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 128,
            position,
          })),
        },
        tradeWishes: {
          create: [
            'Console',
            'Tablette',
            'Écran',
            'Clavier',
            'Casque',
            '   ',
          ].map((label, position) => ({
            label,
            position,
          })),
        },
      },
    });

    const migrationSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_093000_requeue_invalid_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await prisma.$executeRawUnsafe(migrationSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.PENDING);
  });

  it('restores a transaction-bound legacy listing after the corrective migration', async () => {
    const ownerId = `${ownerPrefix}legacy-reserved`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancienne annonce réservée',
        description:
          'Annonce historique déjà liée à une transaction et non modifiable.',
        operationType: ListingOperationType.DONATION,
        status: ListingStatus.APPROVED,
        availabilityStatus: ListingAvailabilityStatus.RESERVED,
      },
    });

    const initialCleanupSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_093000_requeue_invalid_enriched_approvals/migration.sql',
      ),
      'utf8',
    );
    const correctiveSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_104500_reconcile_legacy_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await prisma.$executeRawUnsafe(initialCleanupSql);
    await executeSqlScript(prisma, correctiveSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.APPROVED);
    expect(migrated.availabilityStatus).toBe(
      ListingAvailabilityStatus.RESERVED,
    );
    expect(migrated.moderationReason).toBeNull();
  });

  it('requeues legacy trade wishes containing JavaScript-trim whitespace', async () => {
    const ownerId = `${ownerPrefix}legacy-trade-tab`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancien troc avec tabulation',
        description:
          'Ancienne annonce avec quatre souhaits réels et une tabulation.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
        images: {
          create: Array.from({ length: 5 }, (_, position) => ({
            objectKey: `legacy/${ownerId}/${position}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 128,
            position,
          })),
        },
        tradeWishes: {
          create: ['Console', 'Tablette', 'Écran', 'Clavier', '\t'].map(
            (label, position) => ({
              label,
              position,
            }),
          ),
        },
      },
    });

    const initialCleanupSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_093000_requeue_invalid_enriched_approvals/migration.sql',
      ),
      'utf8',
    );
    const correctiveSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_104500_reconcile_legacy_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await prisma.$executeRawUnsafe(initialCleanupSql);
    await executeSqlScript(prisma, correctiveSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.PENDING);
    expect(migrated.moderationReason).toBe(
      'Publication enrichie à compléter avant republication.',
    );
  });

  it('keeps valid legacy wishes beginning or ending with v approved', async () => {
    const ownerId = `${ownerPrefix}legacy-trade-valid-v`;

    const legacy = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Ancien troc valide en v',
        description:
          'Annonce legacy valide dont certains souhaits commencent ou finissent par v.',
        operationType: ListingOperationType.TRADE,
        status: ListingStatus.APPROVED,
        images: {
          create: Array.from({ length: 5 }, (_, position) => ({
            objectKey: `legacy/${ownerId}/${position}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 128,
            position,
          })),
        },
        tradeWishes: {
          create: ['velo', 'liv', 'Console', 'Tablette', 'Écran'].map(
            (label, position) => ({
              label,
              position,
            }),
          ),
        },
      },
    });

    const correctiveSql = readFileSync(
      join(
        __dirname,
        '../prisma/migrations/20260928_104500_reconcile_legacy_enriched_approvals/migration.sql',
      ),
      'utf8',
    );

    await executeSqlScript(prisma, correctiveSql);

    const migrated = await prisma.listing.findUniqueOrThrow({
      where: {
        id: legacy.id,
      },
    });

    expect(migrated.status).toBe(ListingStatus.APPROVED);
    expect(migrated.moderationReason).toBeNull();
  });

  it('stores a rejection reason and keeps the listing private', async () => {
    const ownerId = `${ownerPrefix}user-3`;

    const created = await service.create(ownerId, {
      title: 'Affiche de film',
      description:
        'Affiche de film proposée en donation après vérification de son état.',
      operationType: ListingOperationType.DONATION,
    });

    const rejected = await service.reject(created.id, {
      reason: 'Merci de préciser les dimensions de l’affiche.',
      reviewedUpdatedAt: created.updatedAt.toISOString(),
    });

    expect(rejected.status).toBe(ListingStatus.REJECTED);
    expect(rejected.moderationReason).toBe(
      'Merci de préciser les dimensions de l’affiche.',
    );

    const publiclyVisible = await service.findPublic();
    expect(
      publiclyVisible.some((listing) => listing.id === created.id),
    ).toBe(false);
  });
});
