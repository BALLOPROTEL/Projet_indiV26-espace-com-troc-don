import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectListingDto {
  @ApiProperty({
    example: '2026-09-28T08:45:00.000Z',
    description:
      'Révision exacte de la fiche affichée au modérateur.',
  })
  @IsISO8601()
  reviewedUpdatedAt!: string;

  @ApiProperty({
    example: 'La description doit être précisée avant publication.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
