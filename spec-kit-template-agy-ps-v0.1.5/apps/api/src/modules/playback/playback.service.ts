import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

@Injectable()
export class PlaybackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly metricsService: MetricsService,
  ) {}

  async getSources(userId: string, courseId: string, token?: string) {
    const has = await this.entitlementService.hasCourse(userId, courseId);
    if (!has) throw new ForbiddenException();

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        videos: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { sourceUrl: true },
        },
      },
    });

    if (!course) throw new NotFoundException();
    const url = course.videos[0]?.sourceUrl;
    if (!url) throw new NotFoundException();
    const query = token ? `?pt=${encodeURIComponent(token)}` : '';
    const normalized = url.split('?')[0] ?? url;
    const hlsUrl = normalized.endsWith('.m3u8')
      ? normalized
      : normalized.endsWith('.mp4')
        ? normalized.replace(/\.mp4$/i, '.m3u8')
        : null;
    const dashUrl = normalized.endsWith('.mpd')
      ? normalized
      : normalized.endsWith('.mp4')
        ? normalized.replace(/\.mp4$/i, '.mpd')
        : null;
    this.metricsService.trackPlaybackStart(courseId);
    if (hlsUrl) this.metricsService.trackPlaybackQuality(courseId, 'hls');
    if (dashUrl) this.metricsService.trackPlaybackQuality(courseId, 'dash');
    return {
      sourceUrl: `${url}${query}`,
      hlsUrl: hlsUrl ? `${hlsUrl}${query}` : null,
      dashUrl: dashUrl ? `${dashUrl}${query}` : null,
    };
  }
}
