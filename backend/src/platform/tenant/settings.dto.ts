import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) taxRatePercent?: number;
  @IsOptional() @IsIn(['inclusive', 'exclusive']) taxMode?: 'inclusive' | 'exclusive';
}
