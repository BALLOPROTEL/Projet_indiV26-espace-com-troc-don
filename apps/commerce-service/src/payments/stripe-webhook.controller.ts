import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

type RawRequest = {
  rawBody?: Buffer;
};

@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(
    private readonly payments: PaymentsService,
  ) {}

  @Post('webhook')
  webhook(
    @Req() request: RawRequest,
    @Headers('stripe-signature')
    signature: string | undefined,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException(
        'Raw webhook body is required',
      );
    }

    return this.payments.processWebhook(
      request.rawBody,
      signature,
    );
  }
}
