import { IsOptional, IsString } from 'class-validator';

export class CaptureCheckoutDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  providerOrderId?: string;
}
