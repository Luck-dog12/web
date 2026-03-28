import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCentsUsd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCentsEur?: number;

  @IsIn(['USD', 'EUR'])
  currency!: 'USD' | 'EUR';
}
