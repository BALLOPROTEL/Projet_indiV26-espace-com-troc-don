import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ListingReportStatus } from '../../generated/prisma';
import { AppRole } from '../auth/app-role.enum';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateListingReportDto,
  ListingReportQueryDto,
  ReviewListingReportDto,
} from './dto/listing-report.dto';
import { ListingReportsService } from './listing-reports.service';

@Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('listings/:listingId/reports')
export class ListingReportsController {
  constructor(private readonly reports: ListingReportsService) {}

  @Post()
  create(
    @Param('listingId') listingId: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateListingReportDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is missing');
    }

    return this.reports.create(
      request.user.sub,
      listingId,
      input,
    );
  }
}

@Roles(AppRole.MODERATOR, AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('moderation/reports')
export class ModerationReportsController {
  constructor(private readonly reports: ListingReportsService) {}

  @Get()
  find(@Query() query: ListingReportQueryDto) {
    return this.reports.findForModeration(
      query.status ?? ListingReportStatus.OPEN,
    );
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: ReviewListingReportDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated moderator is missing');
    }

    return this.reports.review(
      id,
      request.user.sub,
      input,
    );
  }
}
