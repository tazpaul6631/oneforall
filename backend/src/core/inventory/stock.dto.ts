import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ReceiveStockDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsInt() @Min(1) @Max(1_000_000) qty: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
