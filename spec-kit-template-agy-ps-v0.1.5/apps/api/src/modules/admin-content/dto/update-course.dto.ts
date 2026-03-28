import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCentsUsd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCentsEur?: number;

  @IsOptional()
  @IsIn(['USD', 'EUR'])
  currency?: 'USD' | 'EUR';

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
