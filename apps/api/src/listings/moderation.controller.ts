import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ModerationQueryDto } from './dto/moderation-query.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('moderation')
@ApiBearerAuth()
@Roles(AppRole.MODERATOR, AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('moderation/listings')
export class ModerationController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les annonces par statut pour modération',
  })
  findForModeration(@Query() query: ModerationQueryDto) {
    return this.listings.findForModeration(
      query.status ?? ListingStatus.PENDING,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver une annonce PENDING' })
  approve(@Param('id') id: string) {
    return this.listings.approve(id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter une annonce PENDING' })
  reject(
    @Param('id') id: string,
    @Body() input: RejectListingDto,
  ) {
    return this.listings.reject(id, input);
  }
}
