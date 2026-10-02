import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PaymentLineDto } from '../../core/order/order.dto';

export class MovieDto {
  @IsString() @MinLength(1) @MaxLength(120) title: string;
  @IsInt() @Min(1) @Max(400) durationMin: number;
  @IsInt() @Min(0) priceVnd: number;
  @IsOptional() @IsInt() @Min(0) vipPriceVnd?: number;
}

export class RoomDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsInt() @Min(1) @Max(12) rows: number;
  @IsInt() @Min(1) @Max(16) cols: number;
  @IsOptional() @IsInt() @Min(0) @Max(12) vipRows?: number;
}

export class ShowtimeDto {
  @IsUUID() movieId: string;
  @IsUUID() roomId: string;
  @IsDateString() startsAt: string;
}

export class CheckoutDto {
  @IsUUID() showtimeId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsUUID('all', { each: true }) seatIds: string[];
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => PaymentLineDto) payments?: PaymentLineDto[];
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey: string;
}
