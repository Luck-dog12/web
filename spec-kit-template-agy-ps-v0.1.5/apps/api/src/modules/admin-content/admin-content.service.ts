import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloudflareStreamService } from '../../common/cloudflare-stream/cloudflare-stream.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateStreamDirectUploadDto } from './dto/create-stream-direct-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflareStreamService: CloudflareStreamService,
  ) {}

  private normalizeEmail(input: string) {
    return input
      .normalize('NFKC')
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .toLowerCase();
  }

  private getAdminUserIds() {
    return (process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const allowed = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => this.normalizeEmail(item))
      .filter(Boolean);
    const adminIds = this.getAdminUserIds();
    if (adminIds.includes(userId)) return;
    if (allowed.length === 0 && adminIds.length === 0) return;
    const userEmail = user?.email ? this.normalizeEmail(user.email) : '';
    if (!userEmail || !allowed.includes(userEmail)) {
      throw new ForbiddenException('Admin only');
    }
  }

  async listCourses() {
    return this.prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        priceCents: true,
        priceCentsUsd: true,
        priceCentsEur: true,
        currency: true,
        videos: {
          select: {
            id: true,
            title: true,
            durationSeconds: true,
            cfStreamVideoId: true,
            playbackPolicy: true,
            streamStatus: true,
            streamReadyToStream: true,
            streamThumbnailUrl: true,
          },
        },
      },
    });
  }

  async createCourse(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        cuisine: dto.cuisine,
        difficulty: dto.difficulty,
        priceCents: dto.priceCents,
        priceCentsUsd: dto.priceCentsUsd ?? (dto.currency === 'USD' ? dto.priceCents : null),
        priceCentsEur: dto.priceCentsEur ?? (dto.currency === 'EUR' ? dto.priceCents : null),
        currency: dto.currency,
        isPublished: false,
      },
      select: { id: true },
    });
  }

  async updateCourse(courseId: string, dto: UpdateCourseDto) {
    await this.prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true } });
    return this.prisma.course.update({
      where: { id: courseId },
      data: dto,
      select: { id: true, isPublished: true },
    });
  }

  async createVideo(courseId: string, dto: CreateVideoDto) {
    await this.requireCourse(courseId);

    const playbackPolicy = this.cloudflareStreamService.normalizePlaybackPolicy(
      dto.playbackPolicy,
    );
    const existingStreamId = dto.cfStreamVideoId?.trim();
    const importUrl = dto.importUrl?.trim();

    if (existingStreamId) {
      await this.assertStreamIdNotAttached(existingStreamId);
      const streamData = await this.buildCloudflareVideoData(
        existingStreamId,
        dto.durationSeconds,
        playbackPolicy,
      );
      return this.prisma.video.create({
        data: {
          courseId,
          title: dto.title,
          ...streamData,
        },
        select: { id: true },
      });
    }

    if (!importUrl) {
      throw new BadRequestException(
        'Provide either cfStreamVideoId or importUrl.',
      );
    }

    if (this.isCloudflarePlaybackUrl(importUrl)) {
      throw new BadRequestException(
        'Import URL must be the original source video file URL. Cloudflare Stream playback URLs such as video.mpd, video.m3u8, or iframe links cannot be imported again.',
      );
    }

    let imported;
    try {
      imported = await this.cloudflareStreamService.copyFromUrl(importUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('could not determine the size of the file') ||
        message.includes('supports HEAD or GET range requests')
      ) {
        throw new BadRequestException(
          'Import URL must point to a directly downloadable source file. The current URL does not expose the file size or byte-range access required by Cloudflare Stream imports.',
        );
      }
      throw error;
    }
    await this.cloudflareStreamService.configureVideo(
      imported.uid,
      playbackPolicy,
    );

    return this.prisma.video.create({
      data: {
        courseId,
        title: dto.title,
        cfStreamVideoId: imported.uid,
        playbackPolicy,
        durationSeconds: dto.durationSeconds ?? imported.durationSeconds,
        streamStatus: imported.status,
        streamReadyToStream: imported.readyToStream,
        streamThumbnailUrl: imported.thumbnailUrl,
      },
      select: { id: true },
    });
  }

  async createStreamDirectUpload(
    courseId: string,
    dto: CreateStreamDirectUploadDto,
  ) {
    await this.requireCourse(courseId);

    const playbackPolicy = this.cloudflareStreamService.normalizePlaybackPolicy(
      dto.playbackPolicy,
    );
    const upload = await this.cloudflareStreamService.createDirectUpload({
      durationSeconds: dto.durationSeconds,
    });

    const video = await this.prisma.video.create({
      data: {
        courseId,
        title: dto.title,
        cfStreamVideoId: upload.uid,
        playbackPolicy,
        durationSeconds: dto.durationSeconds ?? null,
        streamStatus: 'pendingupload',
        streamReadyToStream: false,
      },
      select: { id: true, cfStreamVideoId: true },
    });

    return {
      video,
      uploadUrl: upload.uploadUrl,
    };
  }

  async updateVideo(videoId: string, dto: UpdateVideoDto) {
    const existing = await this.prisma.video.findUniqueOrThrow({
      where: { id: videoId },
      select: {
        id: true,
        cfStreamVideoId: true,
        durationSeconds: true,
        playbackPolicy: true,
      },
    });

    const playbackPolicy = dto.playbackPolicy
      ? this.cloudflareStreamService.normalizePlaybackPolicy(
          dto.playbackPolicy,
        )
      : existing.playbackPolicy;

    let cloudflareUpdate = {};
    if (existing.cfStreamVideoId && dto.playbackPolicy) {
      cloudflareUpdate = await this.buildCloudflareVideoData(
        existing.cfStreamVideoId,
        dto.durationSeconds ?? existing.durationSeconds,
        playbackPolicy,
      );
    }

    return this.prisma.video.update({
      where: { id: videoId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.durationSeconds !== undefined
          ? { durationSeconds: dto.durationSeconds }
          : {}),
        ...(dto.playbackPolicy ? { playbackPolicy } : {}),
        ...cloudflareUpdate,
      },
      select: { id: true },
    });
  }

  async syncVideoStream(videoId: string) {
    const video = await this.prisma.video.findUniqueOrThrow({
      where: { id: videoId },
      select: {
        id: true,
        cfStreamVideoId: true,
        durationSeconds: true,
        playbackPolicy: true,
      },
    });

    if (!video.cfStreamVideoId) {
      return { id: video.id };
    }

    const streamData = await this.buildCloudflareVideoData(
      video.cfStreamVideoId,
      video.durationSeconds,
      video.playbackPolicy,
    );

    return this.prisma.video.update({
      where: { id: video.id },
      data: streamData,
      select: {
        id: true,
        cfStreamVideoId: true,
        playbackPolicy: true,
        streamStatus: true,
        streamReadyToStream: true,
      },
    });
  }

  async deleteVideo(videoId: string) {
    await this.prisma.video.findUniqueOrThrow({ where: { id: videoId }, select: { id: true } });
    return this.prisma.video.delete({ where: { id: videoId }, select: { id: true } });
  }

  async deleteCourse(courseId: string) {
    await this.prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true } });
    return this.prisma.course.delete({ where: { id: courseId }, select: { id: true } });
  }

  private async requireCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException();
    return course;
  }

  private isCloudflarePlaybackUrl(url: string) {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname.endsWith('cloudflarestream.com') &&
        /\/(iframe|manifest\/video\.(m3u8|mpd))$/i.test(parsed.pathname)
      );
    } catch {
      return false;
    }
  }

  private async assertStreamIdNotAttached(cfStreamVideoId: string) {
    const existing = await this.prisma.video.findFirst({
      where: { cfStreamVideoId },
      select: {
        id: true,
        title: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!existing) return;

    throw new ConflictException(
      `This Cloudflare Stream ID is already attached to video "${existing.title}" in course "${existing.course.title}".`,
    );
  }

  private async buildCloudflareVideoData(
    cfStreamVideoId: string,
    durationSeconds: number | null | undefined,
    playbackPolicy: string,
  ) {
    const normalizedPolicy =
      this.cloudflareStreamService.normalizePlaybackPolicy(playbackPolicy);

    const video = await this.cloudflareStreamService.getVideo(cfStreamVideoId);
    await this.cloudflareStreamService.configureVideo(
      cfStreamVideoId,
      normalizedPolicy,
    );

    return {
      cfStreamVideoId: video.uid,
      playbackPolicy: normalizedPolicy,
      durationSeconds: durationSeconds ?? video.durationSeconds,
      streamStatus: video.status,
      streamReadyToStream: video.readyToStream,
      streamThumbnailUrl: video.thumbnailUrl,
    };
  }
}
