import { Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GeoService } from '../../common/geo/geo.service';
import { AuthGuard } from '../auth/auth.guard';
import { PlaybackService } from './playback.service';
import { TokenService } from './token.service';

type PlaybackVariant = 'hls' | 'dash' | 'iframe';

function getRequestBaseUrl(req: Request) {
  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
}

@Controller('playback')
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly tokenService: TokenService,
    private readonly geoService: GeoService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('token/:courseId')
  async token(@Req() req: Request, @Param('courseId') courseId: string) {
    const result = await this.tokenService.createToken(req.session.userId!, courseId);
    return result;
  }

  @UseGuards(AuthGuard)
  @Get('source/:courseId')
  async source(@Req() req: Request, @Param('courseId') courseId: string) {
    this.geoService.assertAllowed(req);
    const token = await this.tokenService.createToken(req.session.userId!, courseId);
    return this.playbackService.getSources(
      req.session.userId!,
      courseId,
      token.token,
      getRequestBaseUrl(req),
    );
  }

  @Get('media/:courseId/:variant')
  async media(
    @Req() req: Request,
    @Res() res: Response,
    @Param('courseId') courseId: string,
    @Param('variant') variant: string,
    @Query('token') token?: string,
  ) {
    this.geoService.assertAllowed(req);

    if (
      variant !== 'hls' &&
      variant !== 'dash' &&
      variant !== 'iframe'
    ) {
      return res.status(404).json({ message: 'Not Found' });
    }
    if (!token) {
      return res.status(403).json({ message: 'Invalid playback token' });
    }

    await this.tokenService.validateToken(courseId, token);
    const redirectUrl = await this.playbackService.getMediaRedirect(
      courseId,
      variant as PlaybackVariant,
      this.geoService.getBlockedCountries(),
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return res.redirect(302, redirectUrl);
  }
}
