import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
