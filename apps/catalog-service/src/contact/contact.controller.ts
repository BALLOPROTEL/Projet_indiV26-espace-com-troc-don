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
import { AppRole } from '../auth/app-role.enum';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ContactService } from './contact.service';
import { PrivacyExecutionService } from './privacy-execution.service';
import {
  ContactAdminQueryDto,
  CreateContactDto,
  CreatePrivacyRequestDto,
  UpdateContactStatusDto,
} from './dto/contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  create(@Body() input: CreateContactDto) {
    return this.contact.createPublic(input);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('contact/privacy')
export class PrivacyContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePrivacyRequestDto,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated user is missing');
    }

    return this.contact.createPrivacyRequest(
      request.user.sub,
      request.user.preferredUsername,
      input,
    );
  }
}

@Roles(AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/contact')
export class AdminContactController {
  constructor(
    private readonly contact: ContactService,
    private readonly privacy: PrivacyExecutionService,
  ) {}

  @Get()
  list(@Query() query: ContactAdminQueryDto) {
    return this.contact.listAdmin(query.status);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateContactStatusDto,
  ) {
    return this.contact.updateStatus(id, input.status);
  }

  @Post(':id/anonymize')
  anonymize(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user?.sub) {
      throw new UnauthorizedException('Authenticated administrator is missing');
    }
    return this.privacy.execute(id, request.user.sub);
  }
}
