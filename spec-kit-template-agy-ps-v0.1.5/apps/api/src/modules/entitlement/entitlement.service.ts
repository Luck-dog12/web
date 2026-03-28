import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EntitlementService {
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

  private getAdminEmails() {
    return (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => this.normalizeEmail(item))
      .filter(Boolean);
  }

  private async isAdmin(userId: string) {
    const adminIds = this.getAdminUserIds();
    if (adminIds.includes(userId)) return true;
    const emails = this.getAdminEmails();
    if (emails.length === 0) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return false;
    return emails.includes(this.normalizeEmail(user.email));
  }

  async grantCourse(userId: string, courseId: string) {
    await this.prisma.entitlement.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
  }

  async hasCourse(userId: string, courseId: string) {
    if (await this.isAdmin(userId)) return true;
    const e = await this.prisma.entitlement.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    return Boolean(e);
  }

  async listCourses(userId: string) {
    const rows = await this.prisma.entitlement.findMany({
      where: { userId },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            cuisine: true,
            difficulty: true,
            priceCents: true,
            currency: true,
            coverImageUrl: true,
          },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });
    return rows.map((r) => r.course);
  }
}
