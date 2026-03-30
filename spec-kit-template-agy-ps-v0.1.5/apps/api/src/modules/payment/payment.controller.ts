import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAppEnv, resolveRequestWebBaseUrl } from '../../common/config/env';
import { GeoService } from '../../common/geo/geo.service';
import { AuthGuard } from '../auth/auth.guard';
import { CancelCheckoutDto } from './dto/cancel-checkout.dto';
import { CaptureCheckoutDto } from './dto/capture-checkout.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly geoService: GeoService,
  ) {}

  @Get('config')
  getConfig() {
    return this.paymentService.getPublicConfig();
  }

  @UseGuards(AuthGuard)
  @Post('checkout/:courseId')
  async checkout(
    @Req() req: Request,
    @Param('courseId') courseId: string,
    @Body() body: CheckoutDto,
  ) {
    const env = getAppEnv();
    this.geoService.assertAllowed(req);
    const webBaseUrl = resolveRequestWebBaseUrl(req, {
      fallback: env.webBaseUrl,
      allowedOrigins: env.webBaseUrls,
    });
    const result = await this.paymentService.createCheckout({
      userId: req.session.userId!,
      courseId,
      webBaseUrl,
      provider: body.provider ?? 'paypal',
      currency: body.currency ?? 'USD',
    });
    return {
      orderId: result.orderId,
      providerOrderId: result.providerOrderId,
      redirectUrl: result.redirectUrl,
    };
  }

  @UseGuards(AuthGuard)
  @Post('capture')
  async capture(@Req() req: Request, @Body() body: CaptureCheckoutDto) {
    return this.paymentService.captureCheckout({
      userId: req.session.userId!,
      orderId: body.orderId,
      providerOrderId: body.providerOrderId,
    });
  }

  @UseGuards(AuthGuard)
  @Post('cancel')
  async cancel(@Req() req: Request, @Body() body: CancelCheckoutDto) {
    return this.paymentService.cancelCheckout({
      userId: req.session.userId!,
      orderId: body.orderId,
      providerOrderId: body.providerOrderId,
    });
  }

  @UseGuards(AuthGuard)
  @Get('orders')
  async listOrders(@Req() req: Request) {
    const orders = await this.paymentService.listOrders(req.session.userId!);
    return { orders };
  }
}
