import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { GeoService } from '../../common/geo/geo.service';
import { AuthGuard } from '../auth/auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentService } from './payment.service';

@UseGuards(AuthGuard)
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly geoService: GeoService,
  ) {}

  @Post('checkout/:courseId')
  async checkout(
    @Req() req: Request,
    @Param('courseId') courseId: string,
    @Body() body: CheckoutDto,
  ) {
    this.geoService.assertAllowed(req);
    const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const result = await this.paymentService.createCheckout({
      userId: req.session.userId!,
      courseId,
      webBaseUrl,
      provider: body.provider ?? 'paypal',
      currency: body.currency ?? 'USD',
    });
    return { orderId: result.orderId, redirectUrl: result.redirectUrl };
  }

  @Get('orders')
  async listOrders(@Req() req: Request) {
    const orders = await this.paymentService.listOrders(req.session.userId!);
    return { orders };
  }
}
