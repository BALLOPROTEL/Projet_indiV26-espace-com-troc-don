import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFanzineDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  excerpt!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  issueLabel?: string;
}

export class UpdateFanzineDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  issueLabel?: string;
}

export class CreateFestivalEntryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(600)
  summary!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateFestivalEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(600)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
