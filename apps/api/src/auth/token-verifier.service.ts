import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class TokenVerifierService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {
    const issuer = this.config.get<string>('KEYCLOAK_ISSUER');
    const audience = this.config.get<string>('KEYCLOAK_AUDIENCE');

    if (!issuer || !audience) {
      throw new Error(
        'KEYCLOAK_ISSUER and KEYCLOAK_AUDIENCE must be configured',
      );
    }

    this.issuer = issuer.replace(/\/$/, '');
    this.audience = audience;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/protocol/openid-connect/certs`),
    );
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });

      if (!payload.sub) {
        throw new Error('JWT subject is missing');
      }

      const realmAccess = payload.realm_access as
        | { roles?: unknown }
        | undefined;

      const roles = Array.isArray(realmAccess?.roles)
        ? realmAccess.roles.filter(
            (role): role is string => typeof role === 'string',
          )
        : [];

      return {
        sub: payload.sub,
        preferredUsername:
          typeof payload.preferred_username === 'string'
            ? payload.preferred_username
            : undefined,
        roles,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
