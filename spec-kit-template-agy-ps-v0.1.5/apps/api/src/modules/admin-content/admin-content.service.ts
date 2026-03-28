import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class AdminContentService {
  constructor(private readonly prisma: PrismaService) {}

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
        videos: { select: { id: true, title: true, durationSeconds: true, sourceUrl: true } },
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
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException();
    return this.prisma.video.create({
      data: {
        courseId: course.id,
        title: dto.title,
        sourceUrl: dto.sourceUrl,
        durationSeconds: dto.durationSeconds ?? null,
      },
      select: { id: true },
    });
  }

  async updateVideo(videoId: string, dto: UpdateVideoDto) {
    await this.prisma.video.findUniqueOrThrow({ where: { id: videoId }, select: { id: true } });
    return this.prisma.video.update({
      where: { id: videoId },
      data: dto,
      select: { id: true },
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
}
