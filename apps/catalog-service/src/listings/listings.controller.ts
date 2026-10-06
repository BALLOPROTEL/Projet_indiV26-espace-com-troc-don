import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppRole } from '../auth/app-role.enum';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les annonces approuvées publiquement',
  })
  findPublic() {
    return this.listings.findPublic();
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une annonce en PENDING' })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateListingDto,
  ) {
    return this.listings.create(
      this.requireSubject(request),
      input,
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Lister les annonces de l'utilisateur courant",
  })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  findMine(@Req() request: AuthenticatedRequest) {
    return this.listings.findMine(
      this.requireSubject(request),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une annonce approuvée publiquement',
  })
  findPublicById(@Param('id') id: string) {
    return this.listings.findPublicById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Modifier sa propre annonce non approuvée et la remettre en PENDING",
  })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateOwned(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateListingDto,
  ) {
    return this.listings.updateOwned(
      id,
      this.requireSubject(request),
      input,
    );
  }

  private requireSubject(
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
