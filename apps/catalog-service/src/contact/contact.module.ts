import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminContactController,
  ContactController,
  PrivacyContactController,
} from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ContactController,
    PrivacyContactController,
    AdminContactController,
  ],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
