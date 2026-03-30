import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateStreamDirectUploadDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'signed'])
  playbackPolicy?: 'public' | 'signed';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}
