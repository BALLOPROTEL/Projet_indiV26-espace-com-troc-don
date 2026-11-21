import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  recipientFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  recipientLastName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  addressLine1!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postalCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
}
