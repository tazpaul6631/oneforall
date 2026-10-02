import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsString() @MinLength(2) @MaxLength(80) tenantName: string;
  @IsString() preset: string;
  @IsString() @MinLength(2) @MaxLength(80) fullName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' }) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(80) fullName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' }) password: string;
  @IsIn(['manager', 'staff']) role: 'manager' | 'staff';
}

export class UpdateUserDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsIn(['manager', 'staff']) role?: 'manager' | 'staff';
}
