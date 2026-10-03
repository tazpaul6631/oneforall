import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class OrderLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsInt() @Min(1) @Max(999) qty: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) optionIds?: string[];
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class DiscountDto {
  @IsIn(['percent', 'amount']) type: 'percent' | 'amount';
  @IsInt() @Min(0) value: number;
}

export class PreviewOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  lines: OrderLineDto[];
  @IsOptional() @ValidateNested() @Type(() => DiscountDto) discount?: DiscountDto;
}

export class CreateOrderDto extends PreviewOrderDto {
  @IsOptional() @IsString() @MaxLength(200) note?: string;
  @IsOptional() @IsUUID() customerId?: string;
}

export class RefundLineDto {
  @IsUUID() lineId: string;
  @IsInt() @Min(1) @Max(999) qty: number;
}

export class RefundDto {
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RefundLineDto) lines?: RefundLineDto[];
  @IsOptional() @IsInt() @Min(1) amountVnd?: number;
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class SplitPartDto {
  @IsUUID() lineId: string;
  @IsInt() @Min(1) @Max(999) qty: number;
}

export class SplitOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SplitPartDto) lines: SplitPartDto[];
}

export class MergeOrderDto {
  @IsUUID() targetOrderId: string;
  @IsUUID() sourceOrderId: string;
}

export class PaymentLineDto {
  @IsIn(['cash', 'transfer']) method: 'cash' | 'transfer';
  @IsInt() @Min(1) amountVnd: number;
}

export class PayOrderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentLineDto) payments: PaymentLineDto[];
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey: string;
}
