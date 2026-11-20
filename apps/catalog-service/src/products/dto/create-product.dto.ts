import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'FIG-GARDIEN-STD', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  sku!: string;

  @ApiProperty({ example: 'Édition standard', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @ApiProperty({
    example: 3990,
    description: 'Prix unitaire en centimes, calculé et stocké côté serveur.',
  })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  priceCents!: number;

  @ApiProperty({ example: 12, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateProductDto {
  @ApiProperty({
    example: 'figurine-gardien-ombres',
    maxLength: 140,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ example: 'Figurine de collection', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ example: 'Figurines', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category!: string;

  @ApiPropertyOptional({
    example: 'EUR',
    default: 'EUR',
    description: 'Devise ISO 4217. L4A accepte uniquement EUR.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^EUR$/)
  currency?: string;

  @ApiProperty({ type: [CreateProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}
