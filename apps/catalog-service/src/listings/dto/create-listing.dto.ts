import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingOperationType } from '../../../generated/prisma';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({
    example: 'Échange de romans fantastiques',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example:
      'Je propose trois romans fantastiques en très bon état contre un autre lot.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    enum: ListingOperationType,
    example: ListingOperationType.TRADE,
  })
  @IsEnum(ListingOperationType)
  operationType!: ListingOperationType;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 10,
    example: [
      'Nintendo Switch',
      'Steam Deck',
      'Tablette',
      'Ordinateur portable',
      'Écran gaming',
    ],
    description:
      'Obligatoire pour un troc : 5 à 10 souhaits distincts. Interdit pour un don.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  tradeWishes?: string[];
}
