import { IsOptional, IsString } from 'class-validator';

export class CancelCheckoutDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  providerOrderId?: string;
}
