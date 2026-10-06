import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateProposalInput,
  ProposalsService,
} from './proposals.service';

@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateProposalInput,
  ) {
    return this.proposals.create(this.actorId(request), input);
  }

  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.proposals.findMine(this.actorId(request));
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is missing');
    }

    return request.user.sub;
  }
}
