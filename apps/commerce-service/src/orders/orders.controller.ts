import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthenticatedRequest,
} from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Préparer un brouillon de commande réel depuis le panier courant',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateOrderDto,
  ) {
    return this.orders.createDraft(
      this.subject(request),
      this.idempotencyKey(idempotencyKey),
      input,
    );
  }

  @Post(':id/reserve')
  @ApiOperation({
    summary: 'Réserver réellement le stock avant paiement',
  })
  reserve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.reserve(
      this.subject(request),
      id,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Annuler la commande et libérer le stock réservé',
  })
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.cancel(
      this.subject(request),
      id,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les commandes du compte connecté',
  })
  list(@Req() request: AuthenticatedRequest) {
    return this.orders.list(this.subject(request));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lire une commande strictement propriétaire',
  })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.get(this.subject(request), id);
  }

  private subject(
    request: AuthenticatedRequest,
  ): string {
    if (!request.user?.sub) {
      throw new Error(
        'Authenticated subject missing after JwtAuthGuard',
      );
    }

    return request.user.sub;
  }

  private idempotencyKey(
    value: string | undefined,
  ): string {
    const key = value?.trim();

    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException(
        'A valid Idempotency-Key header is required',
      );
    }

    return key;
  }
}
