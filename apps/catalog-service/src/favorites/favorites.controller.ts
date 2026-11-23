import {
  Controller,
  Delete,
  Get,
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
import { AppRole } from '../auth/app-role.enum';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "Lister les favoris de l'utilisateur courant" })
  findMine(@Req() request: AuthenticatedRequest) {
    return this.favorites.findMine(this.requireSubject(request));
  }

  @Get(':listingId')
  @ApiOperation({ summary: "Lire l'état favori d'une annonce" })
  state(
    @Param('listingId') listingId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favorites.state(
      this.requireSubject(request),
      listingId,
    );
  }

  @Post(':listingId')
  @ApiOperation({ summary: 'Ajouter une annonce approuvée aux favoris' })
  add(
    @Param('listingId') listingId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favorites.add(
      this.requireSubject(request),
      listingId,
    );
  }

  @Delete(':listingId')
  @ApiOperation({ summary: 'Retirer une annonce des favoris' })
  remove(
    @Param('listingId') listingId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favorites.remove(
      this.requireSubject(request),
      listingId,
    );
  }

  private requireSubject(request: AuthenticatedRequest): string {
    if (!request.user?.sub) {
      throw new Error(
        'Authenticated subject missing after JwtAuthGuard',
      );
    }

    return request.user.sub;
  }
}
