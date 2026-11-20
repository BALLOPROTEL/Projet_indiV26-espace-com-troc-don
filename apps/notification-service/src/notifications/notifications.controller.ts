import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppRole } from '../auth/app-role.enum';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationStore } from './notification.store';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly store: NotificationStore) {}

  // Technical compatibility endpoint. Gateway intentionally does not route it.
  @Get('recent')
  recent() {
    return this.store.recent();
  }

  @Get('me')
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  mine(@Req() request: AuthenticatedRequest) {
    return this.store.recentForUser(this.requireSubject(request));
  }

  private requireSubject(request: AuthenticatedRequest): string {
    if (!request.user?.sub) {
      throw new Error(
        'Authenticated subject missing after JwtAuthGuard',
      );
    }

    return request.user.sub;
  }
}
