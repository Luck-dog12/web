import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  title!: string;

  @IsString()
  sourceUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
