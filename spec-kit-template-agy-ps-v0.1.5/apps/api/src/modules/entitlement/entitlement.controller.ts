import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { EntitlementService } from './entitlement.service';

@UseGuards(AuthGuard)
@Controller('entitlements')
export class EntitlementController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Get()
  async list(@Req() req: Request) {
    const courses = await this.entitlementService.listCourses(
      req.session.userId!,
    );
    return { courses };
  }

  @Get(':courseId')
  async has(@Req() req: Request, @Param('courseId') courseId: string) {
    const has = await this.entitlementService.hasCourse(
      req.session.userId!,
      courseId,
    );
    return { has };
  }
}
