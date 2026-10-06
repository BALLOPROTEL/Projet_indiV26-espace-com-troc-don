import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingOperationType } from '../../../generated/prisma';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateListingDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ListingOperationType })
  @IsOptional()
  @IsEnum(ListingOperationType)
  operationType?: ListingOperationType;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 10,
    description:
      '5 à 10 souhaits distincts pour un troc ; vide pour un don.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  tradeWishes?: string[];
}
