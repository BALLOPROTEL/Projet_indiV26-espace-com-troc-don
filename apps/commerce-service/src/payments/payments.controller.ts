import {
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedRequest,
} from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
  ) {}

  @Post(':id/payment-session')
  createSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (!request.user?.sub) {
      throw new Error(
        'Authenticated subject missing after JwtAuthGuard',
      );
    }

    return this.payments.createSession(
      request.user.sub,
      id,
    );
  }
}
