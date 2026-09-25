import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenVerifierService } from './token-verifier.service';

describe('JwtAuthGuard', () => {
  const verifier = {
    verify: jest.fn(),
  } as unknown as TokenVerifierService;

  const guard = new JwtAuthGuard(verifier);

  const contextWithAuthorization = (authorization?: string) => {
    const request = {
      headers: {
        authorization,
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the bearer token is missing', async () => {
    const { context } = contextWithAuthorization();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns 401 when the Authorization header is malformed', async () => {
    const { context } = contextWithAuthorization('Basic abc');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a valid bearer token and attaches the user', async () => {
    const user = {
      sub: 'user-id',
      preferredUsername: 'demo-user',
      roles: ['USER'],
    };

    (verifier.verify as jest.Mock).mockResolvedValue(user);

    const { context, request } =
      contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(user);
  });
});
