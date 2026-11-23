import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 99, example: 1 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
