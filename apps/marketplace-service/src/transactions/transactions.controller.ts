import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.transactions.findMine(this.actorId(request));
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.confirm(id, this.actorId(request));
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is missing');
    }

    return request.user.sub;
  }
}
