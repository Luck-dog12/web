import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import session from 'express-session';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

jest.setTimeout(15000);

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.ADMIN_EMAILS = '';
    process.env.BLOCKED_COUNTRIES = '';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      session({
        name: 'sid',
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', secure: false },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ ok: true });
  });

  it('/payment/checkout/:courseId (POST) should require auth', () => {
    return request(app.getHttpServer()).post('/payment/checkout/test-course').expect(401);
  });

  it('/playback/source/:courseId (GET) should require auth', () => {
    return request(app.getHttpServer()).get('/playback/source/test-course').expect(401);
  });

  it('/payment/webhook/paypal (POST) should update pending order', async () => {
    const email = `paypal-e2e-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: 'hash' },
      select: { id: true },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Webhook Course',
        description: 'Webhook Course',
        cuisine: 'Global',
        difficulty: 'Beginner',
        priceCents: 1000,
        priceCentsUsd: 1000,
        priceCentsEur: 900,
        currency: 'USD',
      },
      select: { id: true },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amountCents: 900,
        currency: 'EUR',
        provider: 'paypal',
        status: 'pending',
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/payment/webhook/paypal')
      .send({ status: 'COMPLETED', orderId: order.id })
      .expect(201);

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    expect(updated?.status).toBe('paid');
  });

  it('admin-content CRUD should work for admin user', async () => {
    const server = app.getHttpServer();
    const adminAgent = request.agent(server);
    const email = `admin-${Date.now()}@example.com`;
    process.env.ADMIN_EMAILS = email;
    await adminAgent.post('/auth/register').send({ email, password: 'password123' }).expect(201);

    const createCourse = await adminAgent.post('/admin-content/courses').send({
      title: 'Admin Course',
      description: 'Admin Course',
      currency: 'USD',
      priceCents: 1200,
      priceCentsUsd: 1200,
      priceCentsEur: 1000,
    });
    expect(createCourse.status).toBe(201);
    const courseId = (createCourse.body as { id: string }).id;

    const createVideo = await adminAgent
      .post(`/admin-content/courses/${courseId}/videos`)
      .send({ title: 'Lesson 1', sourceUrl: 'https://example.com/video.mp4', durationSeconds: 120 });
    expect(createVideo.status).toBe(201);

    const publish = await adminAgent
      .patch(`/admin-content/courses/${courseId}`)
      .send({ isPublished: true });
    expect(publish.status).toBe(200);
  });

  it('geo restriction and metrics should be observable', async () => {
    const server = app.getHttpServer();
    const buyerAgent = request.agent(server);
    const email = `buyer-${Date.now()}@example.com`;
    await buyerAgent.post('/auth/register').send({ email, password: 'password123' }).expect(201);

    const course = await prisma.course.create({
      data: {
        title: 'Geo Course',
        description: 'Geo Course',
        currency: 'USD',
        priceCents: 1500,
        priceCentsUsd: 1500,
        priceCentsEur: 1300,
        isPublished: true,
        videos: {
          create: [{ title: 'Geo Video', sourceUrl: 'https://example.com/geo.mp4' }],
        },
      },
      select: { id: true },
    });

    process.env.BLOCKED_COUNTRIES = 'CN';
    await buyerAgent
      .post(`/payment/checkout/${course.id}`)
      .set('x-country', 'CN')
      .send({ provider: 'paypal', currency: 'USD' })
      .expect(403);

    await prisma.entitlement.create({
      data: { userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id, courseId: course.id },
    });

    await buyerAgent.get(`/playback/source/${course.id}`).set('x-country', 'CN').expect(403);
    process.env.BLOCKED_COUNTRIES = '';

    await buyerAgent.post('/metrics/event').send({ name: 'retention', courseId: course.id }).expect(201);
    const metricsRes = await buyerAgent.get('/metrics').expect(200);
    const metrics = metricsRes.body as { retentionSignals: number };
    expect(metrics.retentionSignals).toBeGreaterThan(0);
  });
});
