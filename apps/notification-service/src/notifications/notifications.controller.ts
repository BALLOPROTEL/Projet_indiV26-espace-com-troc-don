import { Controller, Get } from '@nestjs/common';
import { NotificationStore } from './notification.store';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly store: NotificationStore) {}

  @Get('recent')
  recent() {
    return this.store.recent();
  }
}
