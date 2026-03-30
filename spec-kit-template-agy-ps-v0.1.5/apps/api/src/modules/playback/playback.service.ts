import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CloudflareStreamService,
  StreamPlaybackPolicy,
} from '../../common/cloudflare-stream/cloudflare-stream.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

type StreamMedia = {
  videoId: string;
  thumbnailUrl: string | null;
  playbackPolicy: StreamPlaybackPolicy;
};

@Injectable()
export class PlaybackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly metricsService: MetricsService,
    private readonly cloudflareStreamService: CloudflareStreamService,
  ) {}

  private buildTokenizedPlaybackUrl(
    deliveryBaseUrl: string,
    courseId: string,
    token: string,
    variant: 'hls' | 'dash' | 'iframe',
  ) {
    return `${deliveryBaseUrl}/playback/media/${courseId}/${variant}?token=${encodeURIComponent(token)}`;
  }

  private async getCourseMedia(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        videos: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            id: true,
            cfStreamVideoId: true,
            playbackPolicy: true,
            durationSeconds: true,
          },
        },
      },
    });

    if (!course) throw new NotFoundException();
    const video = course.videos[0];
    if (!video) throw new NotFoundException();
    if (!video.cfStreamVideoId) {
      throw new ConflictException('Video is not configured in Cloudflare Stream.');
    }

    const playbackPolicy = this.cloudflareStreamService.normalizePlaybackPolicy(
      video.playbackPolicy,
    );
    const streamVideo = await this.cloudflareStreamService.getVideo(
      video.cfStreamVideoId,
    );

    await this.prisma.video
      .update({
        where: { id: video.id },
        data: {
          durationSeconds:
            video.durationSeconds ?? streamVideo.durationSeconds,
          streamStatus: streamVideo.status,
          streamReadyToStream: streamVideo.readyToStream,
          streamThumbnailUrl: streamVideo.thumbnailUrl,
        },
        select: { id: true },
      })
      .catch(() => undefined);

    if (!streamVideo.readyToStream) {
      throw new ConflictException(
        'Video is still processing in Cloudflare Stream.',
      );
    }

    return {
      videoId: video.cfStreamVideoId,
      thumbnailUrl: streamVideo.thumbnailUrl,
      playbackPolicy,
    } satisfies StreamMedia;
  }

  async getSources(userId: string, courseId: string, token: string, deliveryBaseUrl: string) {
    const has = await this.entitlementService.hasCourse(userId, courseId);
    if (!has) throw new ForbiddenException();

    const media = await this.getCourseMedia(courseId);
    this.metricsService.trackPlaybackStart(courseId);
    this.metricsService.trackPlaybackQuality(courseId, 'cloudflare-stream');
    return {
      provider: 'cloudflare-stream',
      hlsUrl: this.buildTokenizedPlaybackUrl(
        deliveryBaseUrl,
        courseId,
        token,
        'hls',
      ),
      dashUrl: this.buildTokenizedPlaybackUrl(
        deliveryBaseUrl,
        courseId,
        token,
        'dash',
      ),
      iframeUrl: this.buildTokenizedPlaybackUrl(
        deliveryBaseUrl,
        courseId,
        token,
        'iframe',
      ),
      thumbnailUrl: media.thumbnailUrl,
      playbackPolicy: media.playbackPolicy,
    };
  }

  async getMediaRedirect(
    courseId: string,
    variant: 'hls' | 'dash' | 'iframe',
    blockedCountries: string[] = [],
  ) {
    const media = await this.getCourseMedia(courseId);
    return this.cloudflareStreamService.buildPlaybackUrl({
      videoId: media.videoId,
      variant,
      playbackPolicy: media.playbackPolicy,
      blockedCountries,
    });
  }
}
