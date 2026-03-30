import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  importUrl?: string;

  @IsOptional()
  @IsString()
  cfStreamVideoId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'signed'])
  playbackPolicy?: 'public' | 'signed';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
