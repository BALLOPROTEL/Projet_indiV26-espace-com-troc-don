import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductVariantDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({
    description: 'Prix unitaire en centimes.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceCents?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
