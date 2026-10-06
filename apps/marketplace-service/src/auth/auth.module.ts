import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOKEN_VERIFIER } from './token-verifier.port';
import { TokenVerifierService } from './token-verifier.service';

@Module({
  providers: [
    TokenVerifierService,
    {
      provide: TOKEN_VERIFIER,
      useExisting: TokenVerifierService,
    },
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, TOKEN_VERIFIER],
})
export class AuthModule {}
