import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateFanzineDto,
  CreateFestivalEntryDto,
  UpdateFanzineDto,
  UpdateFestivalEntryDto,
} from './dto/editorial.dto';
import { EditorialService } from './editorial.service';

@Controller('fanzines')
export class FanzinesController {
  constructor(private readonly editorial: EditorialService) {}

  @Get()
  findPublic() {
    return this.editorial.findPublicFanzines();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.editorial.findPublicFanzine(slug);
  }
}

@Controller('festival')
export class FestivalController {
  constructor(private readonly editorial: EditorialService) {}

  @Get()
  findPublic() {
    return this.editorial.findPublicFestival();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.editorial.findPublicFestivalEntry(slug);
  }
}

@Roles(AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminEditorialController {
  constructor(private readonly editorial: EditorialService) {}

  @Get('fanzines')
  fanzines() {
    return this.editorial.findAdminFanzines();
  }

  @Post('fanzines')
  createFanzine(@Body() input: CreateFanzineDto) {
    return this.editorial.createFanzine(input);
  }

  @Patch('fanzines/:id')
  updateFanzine(
    @Param('id') id: string,
    @Body() input: UpdateFanzineDto,
  ) {
    return this.editorial.updateFanzine(id, input);
  }

  @Post('fanzines/:id/publish')
  @HttpCode(200)
  publishFanzine(@Param('id') id: string) {
    return this.editorial.publishFanzine(id);
  }

  @Post('fanzines/:id/archive')
  @HttpCode(200)
  archiveFanzine(@Param('id') id: string) {
    return this.editorial.archiveFanzine(id);
  }

  @Get('festival')
  festival() {
    return this.editorial.findAdminFestival();
  }

  @Post('festival')
  createFestival(@Body() input: CreateFestivalEntryDto) {
    return this.editorial.createFestivalEntry(input);
  }

  @Patch('festival/:id')
  updateFestival(
    @Param('id') id: string,
    @Body() input: UpdateFestivalEntryDto,
  ) {
    return this.editorial.updateFestivalEntry(id, input);
  }

  @Post('festival/:id/publish')
  @HttpCode(200)
  publishFestival(@Param('id') id: string) {
    return this.editorial.publishFestivalEntry(id);
  }

  @Post('festival/:id/archive')
  @HttpCode(200)
  archiveFestival(@Param('id') id: string) {
    return this.editorial.archiveFestivalEntry(id);
  }
}
