import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
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
import { ListingsController } from '../src/listings/listings.controller';
import { ListingsService } from '../src/listings/listings.service';
import { ModerationController } from '../src/listings/moderation.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Listings HTTP acceptance E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
      controllers: [ListingsController, ModerationController],
      providers: [
        PrismaService,
        ListingsService,
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

    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: 'lot4-e2e-',
        },
      },
    });
  });

  afterAll(async () => {
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
