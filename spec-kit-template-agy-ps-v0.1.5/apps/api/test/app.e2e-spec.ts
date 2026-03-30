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
    return request(app.getHttpServer())
      .post('/payment/checkout/test-course')
      .expect(401);
  });

  it('/payment/config (GET) should expose PayPal client configuration without auth', async () => {
    process.env.PAYPAL_CLIENT_ID = 'paypal-client-id';

    const response = await request(app.getHttpServer())
      .get('/payment/config')
      .expect(200);

    expect(response.body).toEqual({ paypalClientId: 'paypal-client-id' });
    delete process.env.PAYPAL_CLIENT_ID;
  });

  it('/playback/source/:courseId (GET) should require auth', () => {
    return request(app.getHttpServer())
      .get('/playback/source/test-course')
      .expect(401);
  });

  it('/payment/webhook/paypal (POST) should require configured webhook verification', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;

    await request(app.getHttpServer())
      .post('/payment/webhook/paypal')
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED' })
      .expect(503);
  });

  it('/payment/capture (POST) should mark pending order paid', async () => {
    const server = app.getHttpServer();
    const buyerAgent = request.agent(server);
    const email = `capture-${Date.now()}@example.com`;
    await buyerAgent
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Capture Course',
        description: 'Capture Course',
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
        amountCents: 1000,
        currency: 'USD',
        provider: 'paypal',
        providerSessionId: 'PAYPAL-ORDER-123',
        status: 'pending',
      },
      select: { id: true },
    });

    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'paypal-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  captures: [{ id: 'CAPTURE-123', status: 'COMPLETED' }],
                },
              },
            ],
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    process.env.PAYPAL_CLIENT_ID = 'paypal-client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
    global.fetch = fetchMock as typeof fetch;

    try {
      const captureRes = await buyerAgent
        .post('/payment/capture')
        .send({ orderId: order.id, providerOrderId: 'PAYPAL-ORDER-123' })
        .expect(201);

      expect(captureRes.body).toMatchObject({
        orderId: order.id,
        courseId: course.id,
        status: 'paid',
      });

      const updated = await prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true },
      });
      expect(updated?.status).toBe('paid');

      const entitlement = await prisma.entitlement.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { id: true },
      });
      expect(entitlement?.id).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
    }
  });

  it('admin-content CRUD should work for admin user', async () => {
    const server = app.getHttpServer();
    const adminAgent = request.agent(server);
    const email = `admin-${Date.now()}@example.com`;
    process.env.ADMIN_EMAILS = email;
    process.env.CF_STREAM_ACCOUNT_ID = 'test-account';
    process.env.CF_STREAM_API_TOKEN = 'test-token';
    process.env.CF_STREAM_CUSTOMER_CODE = 'customer-test';
    await adminAgent
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

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

    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              uid: 'stream-video-1',
              readyToStream: true,
              duration: 120,
              thumbnail: 'https://example.com/thumb.jpg',
              status: { state: 'ready' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, result: { uid: 'stream-video-1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ) as typeof fetch;

    try {
      const createVideo = await adminAgent
        .post(`/admin-content/courses/${courseId}/videos`)
        .send({
          title: 'Lesson 1',
          cfStreamVideoId: 'stream-video-1',
          durationSeconds: 120,
          playbackPolicy: 'signed',
        });
      expect(createVideo.status).toBe(201);
    } finally {
      global.fetch = originalFetch;
      delete process.env.CF_STREAM_ACCOUNT_ID;
      delete process.env.CF_STREAM_API_TOKEN;
      delete process.env.CF_STREAM_CUSTOMER_CODE;
    }

    const publish = await adminAgent
      .patch(`/admin-content/courses/${courseId}`)
      .send({ isPublished: true });
    expect(publish.status).toBe(200);
  });

  it('geo restriction and metrics should be observable', async () => {
    const server = app.getHttpServer();
    const buyerAgent = request.agent(server);
    const email = `buyer-${Date.now()}@example.com`;
    await buyerAgent
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

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
          create: [
            {
              title: 'Geo Video',
              cfStreamVideoId: 'geo-stream-video',
              playbackPolicy: 'signed',
              streamStatus: 'ready',
              streamReadyToStream: true,
            },
          ],
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
      data: {
        userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
        courseId: course.id,
      },
    });

    await buyerAgent
      .get(`/playback/source/${course.id}`)
      .set('x-country', 'CN')
      .expect(403);
    process.env.BLOCKED_COUNTRIES = '';

    await buyerAgent
      .post('/metrics/event')
      .send({ name: 'retention', courseId: course.id })
      .expect(201);
    const metricsRes = await buyerAgent.get('/metrics').expect(200);
    const metrics = metricsRes.body as { retentionSignals: number };
    expect(metrics.retentionSignals).toBeGreaterThan(0);
  });
});
