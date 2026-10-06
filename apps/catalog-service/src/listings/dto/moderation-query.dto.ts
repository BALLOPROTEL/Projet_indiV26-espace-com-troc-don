import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ModerationQueryDto {
  @ApiPropertyOptional({
    enum: ListingStatus,
    default: ListingStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
