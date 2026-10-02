import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CustomerDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @ValidateIf((o) => o.email !== '' && o.email != null) @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @ValidateIf((o) => o.email !== '' && o.email != null) @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
