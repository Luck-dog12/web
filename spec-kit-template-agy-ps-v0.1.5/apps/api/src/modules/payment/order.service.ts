import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async createPendingOrder(params: {
    userId: string;
    courseId: string;
    provider: string;
    currency: 'USD' | 'EUR';
  }) {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      select: {
        id: true,
        priceCents: true,
        currency: true,
        priceCentsUsd: true,
        priceCentsEur: true,
      },
    });
    if (!course) throw new NotFoundException();

    const configuredAmount =
      params.currency === 'EUR'
        ? (course.priceCentsEur ?? (course.currency === 'EUR' ? course.priceCents : null))
        : (course.priceCentsUsd ?? (course.currency === 'USD' ? course.priceCents : null));
    const amountCents =
      configuredAmount ??
      (params.currency === 'EUR'
        ? Math.round(course.priceCents * 0.9)
        : Math.round(course.priceCents / 0.9));

    const order = await this.prisma.order.create({
      data: {
        userId: params.userId,
        courseId: course.id,
        amountCents,
        currency: params.currency,
        status: 'pending',
        provider: params.provider,
      },
      select: { id: true, courseId: true, amountCents: true, currency: true, status: true },
    });

    return order;
  }

  async attachProviderSession(orderId: string, providerSessionId: string) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { providerSessionId },
      select: { id: true },
    });
  }

  async markPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, userId: true, courseId: true },
    });
    if (!order) throw new NotFoundException();
    if (order.status === 'paid') return;
    if (order.status !== 'pending') throw new BadRequestException('Invalid order status transition');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid' },
      select: { id: true },
    });

    await this.entitlementService.grantCourse(order.userId, order.courseId);
  }

  async markFailed(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) throw new NotFoundException();
    if (order.status === 'failed') return;
    if (order.status !== 'pending') throw new BadRequestException('Invalid order status transition');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'failed' },
      select: { id: true },
    });
  }

  async markCanceled(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) throw new NotFoundException();
    if (order.status === 'canceled') return;
    if (order.status !== 'pending') throw new BadRequestException('Invalid order status transition');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'canceled' },
      select: { id: true },
    });
  }

  async listOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        createdAt: true,
        course: { select: { id: true, title: true } },
      },
    });
  }
}

