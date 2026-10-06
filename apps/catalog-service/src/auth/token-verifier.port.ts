import { AuthenticatedUser } from './auth.types';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}
