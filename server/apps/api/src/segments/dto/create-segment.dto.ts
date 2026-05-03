import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Rule } from '@drift/shared';

export class CreateSegmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  rules!: Rule;

  @IsOptional()
  @IsBoolean()
  isStatic?: boolean;
}
