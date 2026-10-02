import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
}

export class VariantDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsInt() @Min(0) priceVnd: number;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
}

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsInt({ message: 'Giá phải là số nguyên (đồng)' }) @Min(0) priceVnd: number;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}

export class UpdateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsInt() @Min(0) priceVnd?: number;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}
