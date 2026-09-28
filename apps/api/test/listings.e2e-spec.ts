import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppRole } from '../src/auth/app-role.enum';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import {
  TOKEN_VERIFIER,
  TokenVerifier,
} from '../src/auth/token-verifier.port';
import { RolesGuard } from '../src/auth/roles.guard';
import { ListingImagesController } from '../src/listings/listing-images.controller';
import { ListingImagesService } from '../src/listings/listing-images.service';
import { ListingsController } from '../src/listings/listings.controller';
import { ListingsService } from '../src/listings/listings.service';
import { ModerationController } from '../src/listings/moderation.controller';
import { MarketplaceRulesService } from '../src/marketplace/marketplace-rules.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ObjectStorageService } from '../src/storage/object-storage.service';

describe('Listings HTTP acceptance E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ObjectStorageService;

  const verifier: TokenVerifier = {
    verify: jest.fn(async (token: string) => {
      if (token === 'user-token') {
        return {
          sub: 'lot4-e2e-user',
          preferredUsername: 'lot4-user',
          roles: [AppRole.USER],
        };
      }

      if (token === 'moderator-token') {
        return {
          sub: 'lot4-e2e-moderator',
          preferredUsername: 'lot4-moderator',
          roles: [AppRole.MODERATOR],
        };
      }

      throw new UnauthorizedException('Invalid test token');
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ListingsController,
        ListingImagesController,
        ModerationController,
      ],
      providers: [
        PrismaService,
        ListingsService,
        ListingImagesService,
        MarketplaceRulesService,
        ObjectStorageService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            S3_ENDPOINT:
              process.env.S3_ENDPOINT ??
              'http://127.0.0.1:9000',
            S3_REGION:
              process.env.S3_REGION ?? 'us-east-1',
            S3_BUCKET:
              process.env.S3_BUCKET ?? 'listing-images',
            S3_ACCESS_KEY:
              process.env.S3_ACCESS_KEY ??
              'marketplace-api',
            S3_SECRET_KEY:
              process.env.S3_SECRET_KEY ??
              'marketplace_storage_local_change_me_2026',
            S3_FORCE_PATH_STYLE:
              process.env.S3_FORCE_PATH_STYLE ?? 'true',
          }),
        },
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: TOKEN_VERIFIER,
          useValue: verifier,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(ObjectStorageService);
    await storage.assertReady();

    const staleImages = await prisma.listingImage.findMany({
      where: {
        listing: {
          ownerId: {
            startsWith: 'lot4-e2e-',
          },
        },
      },
      select: {
        objectKey: true,
      },
    });

    if (staleImages.length > 0) {
      await storage.deleteObjects(
        staleImages.map((image) => image.objectKey),
      );
    }

    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: 'lot4-e2e-',
        },
      },
    });
  });

  afterAll(async () => {
    const images = await prisma.listingImage.findMany({
      where: {
        listing: {
          ownerId: {
            startsWith: 'lot4-e2e-',
          },
        },
      },
      select: {
        objectKey: true,
      },
    });

    if (images.length > 0) {
      await storage.deleteObjects(
        images.map((image) => image.objectKey),
      );
    }

    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: 'lot4-e2e-',
        },
      },
    });

    await app.close();
  });

  it('executes USER -> PENDING -> MODERATOR -> APPROVED -> public', async () => {
    const createdResponse = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', 'Bearer user-token')
      .send({
        title: 'LOT 4 E2E listing',
        description:
          'Annonce utilisée pour valider automatiquement le parcours métier.',
        operationType: 'TRADE',
        tradeWishes: [
          'Console',
          'Tablette',
          'Écran',
          'Clavier',
          'Casque',
        ],
      })
      .expect(201);

    const listingId = createdResponse.body.id as string;

    expect(createdResponse.body.status).toBe('PENDING');

    const publicBefore = await request(app.getHttpServer())
      .get('/api/listings')
      .expect(200);

    expect(
      publicBefore.body.some(
        (listing: { id: string }) => listing.id === listingId,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/listings/${listingId}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/moderation/listings?status=PENDING')
      .set('Authorization', 'Bearer user-token')
      .expect(403);

    const moderationQueue = await request(app.getHttpServer())
      .get('/api/moderation/listings?status=PENDING')
      .set('Authorization', 'Bearer moderator-token')
      .expect(200);

    expect(
      moderationQueue.body.some(
        (listing: { id: string }) => listing.id === listingId,
      ),
    ).toBe(true);

    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    let enrichedUpload = request(app.getHttpServer())
      .put(`/api/listings/${listingId}/images`)
      .set('Authorization', 'Bearer user-token');

    for (let index = 0; index < 5; index += 1) {
      enrichedUpload = enrichedUpload.attach(
        'images',
        Buffer.concat([
          signature,
          Buffer.from(`publication-image-${index}`),
        ]),
        {
          filename: `publication-${index}.png`,
          contentType: 'image/png',
        },
      );
    }

    await enrichedUpload.expect(200);

    const approvedResponse = await request(app.getHttpServer())
      .post(`/api/moderation/listings/${listingId}/approve`)
      .set('Authorization', 'Bearer moderator-token')
      .expect(200);

    expect(approvedResponse.body.status).toBe('APPROVED');

    const publicAfter = await request(app.getHttpServer())
      .get('/api/listings')
      .expect(200);

    expect(
      publicAfter.body.some(
        (listing: { id: string }) => listing.id === listingId,
      ),
    ).toBe(true);

    const publicDetail = await request(app.getHttpServer())
      .get(`/api/listings/${listingId}`)
      .expect(200);

    expect(publicDetail.body.id).toBe(listingId);
    expect(publicDetail.body.status).toBe('APPROVED');
    expect(publicDetail.body.images).toHaveLength(5);
    expect(publicDetail.body.tradeWishes).toHaveLength(5);
    expect(publicDetail.body.images[0]).not.toHaveProperty(
      'objectKey',
    );
  });

  it('uploads 5 images through multipart and exposes them only after approval', async () => {
    const createdResponse = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', 'Bearer user-token')
      .send({
        title: 'LOT 9B-B image listing',
        description:
          'Annonce utilisée pour valider le vrai upload multipart vers MinIO.',
        operationType: 'DONATION',
      })
      .expect(201);

    const listingId = createdResponse.body.id as string;
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    let upload = request(app.getHttpServer())
      .put(`/api/listings/${listingId}/images`)
      .set('Authorization', 'Bearer user-token');

    for (let index = 0; index < 5; index += 1) {
      upload = upload.attach(
        'images',
        Buffer.concat([
          signature,
          Buffer.from(`e2e-image-${index}`),
        ]),
        {
          filename: `image-${index}.png`,
          contentType: 'image/png',
        },
      );
    }

    const uploadResponse = await upload.expect(200);

    expect(uploadResponse.body).toHaveLength(5);
    expect(
      uploadResponse.body.every(
        (image: Record<string, unknown>) =>
          !('objectKey' in image),
      ),
    ).toBe(true);

    const pendingImageId = uploadResponse.body[0].id as string;

    await request(app.getHttpServer())
      .get(
        `/api/listings/${listingId}/images/${pendingImageId}/content/authorized`,
      )
      .set('Authorization', 'Bearer moderator-token')
      .expect('Content-Type', /image\/png/)
      .expect(200);

    await request(app.getHttpServer())
      .get(
        `/api/listings/${listingId}/images/${pendingImageId}/content/authorized`,
      )
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/listings/${listingId}/images`)
      .expect(404);

    await request(app.getHttpServer())
      .post(
        `/api/moderation/listings/${listingId}/approve`,
      )
      .set('Authorization', 'Bearer moderator-token')
      .expect(200);

    const publicImages = await request(app.getHttpServer())
      .get(`/api/listings/${listingId}/images`)
      .expect(200);

    expect(publicImages.body).toHaveLength(5);

    const firstImageId = publicImages.body[0].id as string;

    const contentResponse = await request(app.getHttpServer())
      .get(
        `/api/listings/${listingId}/images/${firstImageId}/content`,
      )
      .expect('Content-Type', /image\/png/)
      .expect(200);

    expect(Buffer.isBuffer(contentResponse.body)).toBe(true);
    expect(contentResponse.body.subarray(0, 8)).toEqual(
      signature,
    );
  });

  it('rejects fewer than 5 images and binary/MIME spoofing', async () => {
    const createdResponse = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', 'Bearer user-token')
      .send({
        title: 'LOT 9B-B invalid image listing',
        description:
          'Annonce utilisée pour vérifier le rejet des lots et fichiers invalides.',
        operationType: 'DONATION',
      })
      .expect(201);

    const listingId = createdResponse.body.id as string;
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    let tooFew = request(app.getHttpServer())
      .put(`/api/listings/${listingId}/images`)
      .set('Authorization', 'Bearer user-token');

    for (let index = 0; index < 4; index += 1) {
      tooFew = tooFew.attach(
        'images',
        Buffer.concat([
          signature,
          Buffer.from(`short-${index}`),
        ]),
        {
          filename: `short-${index}.png`,
          contentType: 'image/png',
        },
      );
    }

    await tooFew.expect(400);

    let spoofed = request(app.getHttpServer())
      .put(`/api/listings/${listingId}/images`)
      .set('Authorization', 'Bearer user-token');

    for (let index = 0; index < 5; index += 1) {
      spoofed = spoofed.attach(
        'images',
        Buffer.from(`not-an-image-${index}`),
        {
          filename: `fake-${index}.png`,
          contentType: 'image/png',
        },
      );
    }

    await spoofed.expect(400);
  });

  it('rejects invalid request bodies before business logic', async () => {
    await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', 'Bearer user-token')
      .send({
        title: 'x',
        description: 'too short',
        operationType: 'INVALID',
        unexpected: true,
      })
      .expect(400);
  });

  it('returns 401 when no bearer token is supplied', async () => {
    await request(app.getHttpServer())
      .post('/api/listings')
      .send({
        title: 'Annonce sans authentification',
        description:
          'Cette requête doit être bloquée avant tout accès au métier.',
        operationType: 'DONATION',
      })
      .expect(401);
  });
});
