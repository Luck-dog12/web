import { Body, Controller, Get, Post } from '@nestjs/common';
import { MetricsService } from './common/observability/metrics.service';

@Controller()
export class AppController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('metrics')
  metrics() {
    return this.metricsService.getSnapshot();
  }

  @Post('metrics/event')
  event(@Body() body: { name?: string; courseId?: string }) {
    if (body?.name) this.metricsService.trackClientEvent(body.name, body.courseId);
    return { ok: true };
  }
}
