import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class ReturnLineDto {
  @IsUUID() orderLineId: string;
  @IsInt() @Min(1) @Max(999) qty: number;
}

export class CreateReturnDto {
  @IsUUID() orderId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) lines: ReturnLineDto[];
  @IsOptional() @IsString() @MaxLength(200) note?: string;
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey: string;
}
