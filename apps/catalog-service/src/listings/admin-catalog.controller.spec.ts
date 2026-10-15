import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '../../generated/prisma';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TokenVerifier } from '../auth/token-verifier.port';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { ListingsService } from './listings.service';

describe('ADMIN Catalog summary contract', () => {
  const groupBy = jest.fn();
  const prisma = { listing: { groupBy } } as unknown as PrismaService;
  const listingService = new ListingsService(
    prisma,
    new MarketplaceRulesService(),
  );
  const controller = new AdminCatalogController(listingService);
  const rolesGuard = new RolesGuard(new Reflector());
  const verifier: TokenVerifier = {
    verify: jest.fn().mockResolvedValue({
      sub: 'admin-1',
      roles: [AppRole.ADMIN],
    }),
  };
  const jwtGuard = new JwtAuthGuard(verifier);

  const makeContext = (
    authorization?: string,
    roles?: string[],
  ): ExecutionContext => {
    const request = {
      headers: authorization ? { authorization } : {},
      user: roles ? { sub: 'actor', roles } : undefined,
    };
    return {
      getClass: () => AdminCatalogController,
      getHandler: () => AdminCatalogController.prototype.summary,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a request with no Bearer token (401)', async () => {
    await expect(jwtGuard.canActivate(makeContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([AppRole.USER, AppRole.MODERATOR])(
    'rejects %s from ADMIN-only data (403)',
    (role) => {
      expect(() =>
        rolesGuard.canActivate(makeContext('Bearer valid', [role])),
      ).toThrow(ForbiddenException);
    },
  );

  it('admits ADMIN role under actual @Roles metadata', () => {
    expect(rolesGuard.canActivate(
      makeContext('Bearer valid', [AppRole.ADMIN]),
    )).toBe(true);
  });

  it('returns real grouped listing totals without user identities', async () => {
    groupBy.mockResolvedValue([
      {
        status: ListingStatus.PENDING,
        operationType: ListingOperationType.DONATION,
        availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
        _count: { _all: 2 },
      },
      {
        status: ListingStatus.APPROVED,
        operationType: ListingOperationType.TRADE,
        availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
        _count: { _all: 3 },
      },
      {
        status: ListingStatus.APPROVED,
        operationType: ListingOperationType.DONATION,
        availabilityStatus: ListingAvailabilityStatus.RESERVED,
        _count: { _all: 1 },
      },
      {
        status: ListingStatus.REJECTED,
        operationType: ListingOperationType.TRADE,
        availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
        _count: { _all: 1 },
      },
    ]);
    const summary = await controller.summary();
    expect(summary).toEqual({
      total: 7,
      byStatus: { pending: 2, approved: 4, rejected: 1 },
      byOperation: { donations: 3, trades: 4 },
      approvedAvailability: { available: 3, reserved: 1, completed: 0 },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['status', 'operationType', 'availabilityStatus'],
      _count: { _all: true },
    });
    expect(JSON.stringify(summary)).not.toContain('ownerId');
  });
});
