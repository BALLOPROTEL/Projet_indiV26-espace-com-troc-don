import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TokenVerifierService } from './token-verifier.service';

@Module({
  controllers: [AuthController],
  providers: [TokenVerifierService, JwtAuthGuard, RolesGuard],
  exports: [TokenVerifierService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
