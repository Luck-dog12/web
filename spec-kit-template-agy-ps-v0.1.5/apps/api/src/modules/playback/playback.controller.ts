import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { GeoService } from '../../common/geo/geo.service';
import { AuthGuard } from '../auth/auth.guard';
import { PlaybackService } from './playback.service';
import { TokenService } from './token.service';

@UseGuards(AuthGuard)
@Controller('playback')
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly tokenService: TokenService,
    private readonly geoService: GeoService,
  ) {}

  @Post('token/:courseId')
  async token(@Req() req: Request, @Param('courseId') courseId: string) {
    const result = await this.tokenService.createToken(req.session.userId!, courseId);
    return result;
  }

  @Get('source/:courseId')
  async source(@Req() req: Request, @Param('courseId') courseId: string) {
    this.geoService.assertAllowed(req);
    const token = await this.tokenService.createToken(req.session.userId!, courseId);
    return this.playbackService.getSources(req.session.userId!, courseId, token.token);
  }
}
