import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListingsService } from './listings.service';

/** ADMIN-only aggregate; never returns account or private listing content. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly listings: ListingsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Compteurs réels du catalogue (ADMIN uniquement)',
  })
  summary() {
    return this.listings.adminCatalogSummary();
  }
}
