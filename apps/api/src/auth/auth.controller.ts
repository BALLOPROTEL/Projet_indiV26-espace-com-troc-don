import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppRole } from './app-role.enum';
import { AuthenticatedRequest } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  protected(@Req() request: AuthenticatedRequest) {
    return {
      status: 'ok',
      user: request.user,
    };
  }

  @Get('user')
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  user(@Req() request: AuthenticatedRequest) {
    return {
      status: 'ok',
      requiredRole: AppRole.USER,
      user: request.user,
    };
  }

  @Get('moderator')
  @Roles(AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  moderator(@Req() request: AuthenticatedRequest) {
    return {
      status: 'ok',
      requiredRole: AppRole.MODERATOR,
      user: request.user,
    };
  }

  @Get('admin')
  @Roles(AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  admin(@Req() request: AuthenticatedRequest) {
    return {
      status: 'ok',
      requiredRole: AppRole.ADMIN,
      user: request.user,
    };
  }
}
