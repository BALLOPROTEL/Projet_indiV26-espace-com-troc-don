import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import {
  TOKEN_VERIFIER,
} from './token-verifier.port';
import { TokenVerifierService } from './token-verifier.service';

@Module({
  controllers: [AuthController],
  providers: [
    TokenVerifierService,
    {
      provide: TOKEN_VERIFIER,
      useExisting: TokenVerifierService,
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, TOKEN_VERIFIER],
})
export class AuthModule {}
