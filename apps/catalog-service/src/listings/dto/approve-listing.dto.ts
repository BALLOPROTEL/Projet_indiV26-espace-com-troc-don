import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class ApproveListingDto {
  @ApiProperty({
    example: '2026-09-28T08:45:00.000Z',
    description:
      'Révision exacte de la fiche affichée au modérateur.',
  })
  @IsISO8601()
  reviewedUpdatedAt!: string;
}
