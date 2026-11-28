import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminEditorialController,
  FanzinesController,
  FestivalController,
} from './editorial.controller';
import { EditorialService } from './editorial.service';

@Module({
  imports: [AuthModule],
  controllers: [
    FanzinesController,
    FestivalController,
    AdminEditorialController,
  ],
  providers: [EditorialService],
  exports: [EditorialService],
})
export class EditorialModule {}
