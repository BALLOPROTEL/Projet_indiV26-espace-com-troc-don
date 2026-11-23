import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReserveProductStockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  productId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class ReserveProductStockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  orderId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReserveProductStockItemDto)
  items!: ReserveProductStockItemDto[];
}
