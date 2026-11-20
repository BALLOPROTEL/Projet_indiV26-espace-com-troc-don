import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Lire le panier réel du compte connecté',
  })
  get(@Req() request: AuthenticatedRequest) {
    return this.cart.get(this.subject(request));
  }

  @Post('items')
  @ApiOperation({
    summary: 'Ajouter ou remplacer une quantité de variante',
  })
  add(
    @Req() request: AuthenticatedRequest,
    @Body() input: AddCartItemDto,
  ) {
    return this.cart.addOrReplace(
      this.subject(request),
      input,
    );
  }

  @Patch('items/:variantId')
  @ApiOperation({
    summary: 'Modifier la quantité d’une ligne du panier',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.cart.updateQuantity(
      this.subject(request),
      variantId,
      input.quantity,
    );
  }

  @Delete('items/:variantId')
  @ApiOperation({
    summary: 'Retirer une variante du panier',
  })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.cart.remove(
      this.subject(request),
      variantId,
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Vider entièrement le panier du compte',
  })
  clear(@Req() request: AuthenticatedRequest) {
    return this.cart.clear(this.subject(request));
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
}
