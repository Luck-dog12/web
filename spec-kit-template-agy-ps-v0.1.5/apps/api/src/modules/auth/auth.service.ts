import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(input: string) {
    return input
      .normalize('NFKC')
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .toLowerCase();
  }

  private getAdminEmails() {
    return (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => this.normalizeEmail(item))
      .filter(Boolean);
  }

  private getAdminUserIds() {
    return (process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  getAdminConfigSummaryFor(user: { id: string; email: string }) {
    const adminUserIds = this.getAdminUserIds();
    const adminEmails = this.getAdminEmails();
    const normalizedEmail = this.normalizeEmail(user.email);
    return {
      byUserId: adminUserIds.includes(user.id),
      byEmail: adminEmails.includes(normalizedEmail),
      adminUserIdsCount: adminUserIds.length,
      adminEmailsCount: adminEmails.length,
      normalizedEmail,
      userId: user.id,
    };
  }

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async getSafeUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, createdAt: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const nextHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
      select: { id: true },
    });
  }

  isAdminEmail(email: string) {
    const admins = this.getAdminEmails();
    if (admins.length === 0) return false;
    const normalized = this.normalizeEmail(email);
    return admins.includes(normalized);
  }

  isAdminUser(user: { id: string; email: string }) {
    const byId = this.getAdminUserIds();
    if (byId.includes(user.id)) return true;
    return this.isAdminEmail(user.email);
  }
}
