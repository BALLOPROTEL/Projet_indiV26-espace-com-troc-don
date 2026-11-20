import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ConversationsService,
  CreateConversationMessageInput,
} from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
  ) {}

  @Get()
  listMine(@Req() request: AuthenticatedRequest) {
    return this.conversations.listMine(this.actorId(request));
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('before') before: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversations.listMessages(
      id,
      this.actorId(request),
      before,
      limit,
    );
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateConversationMessageInput,
  ) {
    return this.conversations.sendMessage(
      id,
      this.actorId(request),
      input,
    );
  }

  @Post(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversations.markRead(
      id,
      this.actorId(request),
    );
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.user?.sub) {
      throw new UnauthorizedException(
        'Authenticated user is missing',
      );
    }

    return request.user.sub;
  }
}
