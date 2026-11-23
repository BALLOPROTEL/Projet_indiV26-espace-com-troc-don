import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ListingReportReason,
  ListingReportStatus,
} from '../../../generated/prisma';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateListingReportDto {
  @IsEnum(ListingReportReason)
  reason!: ListingReportReason;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class ListingReportQueryDto {
  @IsOptional()
  @IsEnum(ListingReportStatus)
  status?: ListingReportStatus;
}

export class ReviewListingReportDto {
  @IsEnum(ListingReportStatus)
  @IsIn([
    ListingReportStatus.REVIEWED,
    ListingReportStatus.DISMISSED,
    ListingReportStatus.ACTIONED,
  ])
  status!: ListingReportStatus;
}
