import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminContactController,
  ContactController,
  PrivacyContactController,
} from './contact.controller';
import { ContactService } from './contact.service';
import { PrivacyExecutionService } from './privacy-execution.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ContactController,
    PrivacyContactController,
    AdminContactController,
  ],
  providers: [ContactService, PrivacyExecutionService],
  exports: [ContactService],
})
export class ContactModule {}
