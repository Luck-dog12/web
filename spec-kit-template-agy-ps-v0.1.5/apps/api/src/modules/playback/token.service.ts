import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async createToken(userId: string, courseId: string) {
    const has = await this.entitlementService.hasCourse(userId, courseId);
    if (!has) throw new ForbiddenException();

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.playbackToken.create({
      data: { userId, courseId, token, expiresAt },
      select: { id: true },
    });

    return { token, expiresAt: expiresAt.toISOString() };
  }
}

