import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from './app-role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const contextWithRoles = (roles: string[]) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: 'user-id',
            roles,
          },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an authenticated user when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(contextWithRoles(['USER']))).toBe(true);
  });

  it('returns 403 when the user lacks every required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AppRole.MODERATOR,
      AppRole.ADMIN,
    ]);

    expect(() => guard.canActivate(contextWithRoles(['USER']))).toThrow(
      ForbiddenException,
    );
  });

  it('allows the user when at least one required role is present', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AppRole.MODERATOR,
      AppRole.ADMIN,
    ]);

    expect(guard.canActivate(contextWithRoles(['MODERATOR']))).toBe(true);
  });
});
