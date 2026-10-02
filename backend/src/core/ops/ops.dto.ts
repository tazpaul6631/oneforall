import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivateTenantDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366) days?: number;
}

export class ResetOwnerPasswordDto {
  @IsString() @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' }) password: string;
}
