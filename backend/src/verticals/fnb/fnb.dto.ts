import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { SplitPartDto } from '../../core/order/order.dto';

export class AreaDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
}

export class TableDto {
  @IsUUID() areaId: string;
  @IsString() @MinLength(1) @MaxLength(40) name: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) seats?: number;
}

export class UpdateTableDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) seats?: number;
  @IsOptional() @IsUUID() areaId?: string;
}

export class AssignTableDto {
  @IsUUID() orderId: string;
}

export class TicketStatusDto {
  @IsIn(['queued', 'cooking', 'ready', 'served']) status: 'queued' | 'cooking' | 'ready' | 'served';
}

export class RecipeItemDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsInt() @Min(1) @Max(1_000_000) qty: number;
  @IsString() @MinLength(1) @MaxLength(20) unit: string;
}

export class RecipeDto {
  @IsUUID() productId: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RecipeItemDto) items: RecipeItemDto[];
}

export class SplitBillDto {
  @IsUUID() orderId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SplitPartDto) lines: SplitPartDto[];
}
