import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ContactStatus,
  ContactSubject,
  PrivacyAction,
} from '../../../generated/prisma';

export class CreateContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(ContactSubject)
  @IsIn([
    ContactSubject.SHOP,
    ContactSubject.ACCOUNT,
    ContactSubject.FESTIVAL,
    ContactSubject.FANZINE,
    ContactSubject.OTHER,
  ])
  subject!: ContactSubject;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message!: string;
}

export class CreatePrivacyRequestDto {
  @IsEnum(PrivacyAction)
  action!: PrivacyAction;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message!: string;
}

export class ContactAdminQueryDto {
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;
}

export class UpdateContactStatusDto {
  @IsEnum(ContactStatus)
  status!: ContactStatus;
}
