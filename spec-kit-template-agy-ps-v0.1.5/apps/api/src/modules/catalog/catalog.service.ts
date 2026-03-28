import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.course.count();
    if (count > 0) return;

    await this.prisma.course.create({
      data: {
        title: 'Sushi Basics',
        description: 'Learn the essentials of sushi making.',
        cuisine: 'Japanese',
        difficulty: 'Beginner',
        priceCents: 1999,
        priceCentsUsd: 1999,
        priceCentsEur: 1799,
        currency: 'USD',
        coverImageUrl: null,
        videos: {
          create: [
            {
              title: 'Introduction',
              durationSeconds: 420,
              sourceUrl:
                'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            },
          ],
        },
      },
    });

    await this.prisma.course.create({
      data: {
        title: 'Pasta Mastery',
        description: 'Homemade pasta from scratch.',
        cuisine: 'Italian',
        difficulty: 'Intermediate',
        priceCents: 2999,
        priceCentsUsd: 2999,
        priceCentsEur: 2699,
        currency: 'USD',
        coverImageUrl: null,
        videos: {
          create: [
            {
              title: 'Dough & Rolling',
              durationSeconds: 600,
              sourceUrl:
                'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            },
          ],
        },
      },
    });
  }

  async listCourses() {
    return this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        cuisine: true,
        difficulty: true,
        priceCents: true,
        priceCentsUsd: true,
        priceCentsEur: true,
        currency: true,
        coverImageUrl: true,
      },
    });
  }

  async getCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        description: true,
        cuisine: true,
        difficulty: true,
        priceCents: true,
        priceCentsUsd: true,
        priceCentsEur: true,
        currency: true,
        coverImageUrl: true,
        videos: {
          select: {
            id: true,
            title: true,
            durationSeconds: true,
          },
        },
      },
    });
    if (!course) throw new NotFoundException();
    return course;
  }
}
