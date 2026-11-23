import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalPrivacyGuard } from './internal-privacy.guard';
import { PrivacyService } from './privacy.service';

@UseGuards(InternalPrivacyGuard)
@Controller('internal/privacy/users')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post(':userId/anonymize')
  anonymize(
    @Param('userId') userId: string,
    @Body() body: { replacementId?: unknown },
  ) {
    if (typeof body?.replacementId !== 'string') {
      throw new BadRequestException('replacementId is required');
    }
    return this.privacy.anonymize(userId, body.replacementId);
  }
}
