import { IsIn, IsOptional } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsIn(['paypal'])
  provider?: 'paypal';

  @IsOptional()
  @IsIn(['USD', 'EUR'])
  currency?: 'USD' | 'EUR';
}
