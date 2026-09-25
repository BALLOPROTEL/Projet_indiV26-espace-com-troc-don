import { ApiProperty } from '@nestjs/swagger';
import { ListingOperationType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
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
}
