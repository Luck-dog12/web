import { test, expect } from '@playwright/test';

test('browse → buy → watch', async ({ request }) => {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  const health = await request.get(`${apiBaseUrl}/health`);
  expect(health.ok()).toBeTruthy();

  const anonymousPlayback = await request.get(`${apiBaseUrl}/playback/source/test-course`);
  expect(anonymousPlayback.status()).toBe(401);

  const email = `user${Date.now()}@example.com`;
  const register = await request.post(`${apiBaseUrl}/auth/register`, {
    data: { email, password: 'password123' },
  });
  expect(register.ok()).toBeTruthy();

  const list = await request.get(`${apiBaseUrl}/catalog/courses`);
  expect(list.ok()).toBeTruthy();
  const listData = (await list.json()) as { courses: Array<{ id: string }> };
  expect(listData.courses.length).toBeGreaterThan(0);
  let courseId = listData.courses[0]!.id;
  for (const item of listData.courses) {
    const detail = await request.get(`${apiBaseUrl}/catalog/courses/${item.id}`);
    if (!detail.ok()) continue;
    const detailData = (await detail.json()) as { course: { videos: Array<{ id: string }> } };
    if (detailData.course.videos.length > 0) {
      courseId = item.id;
      break;
    }
  }

  const paypalCheckout = await request.post(`${apiBaseUrl}/payment/checkout/${courseId}`, {
    data: { provider: 'paypal', currency: 'EUR' },
  });
  expect(paypalCheckout.ok()).toBeTruthy();
  const paypalData = (await paypalCheckout.json()) as { orderId: string; redirectUrl: string };
  expect(paypalData.redirectUrl.length).toBeGreaterThan(0);
  const paypalWebhook = await request.post(`${apiBaseUrl}/payment/webhook/paypal`, {
    data: { orderId: paypalData.orderId, status: 'COMPLETED' },
  });
  expect(paypalWebhook.ok()).toBeTruthy();

  const entitlement = await request.get(`${apiBaseUrl}/entitlements/${courseId}`);
  expect(entitlement.ok()).toBeTruthy();
  const entitlementData = (await entitlement.json()) as { has: boolean };
  expect(entitlementData.has).toBeTruthy();

  const source = await request.get(`${apiBaseUrl}/playback/source/${courseId}`);
  expect(source.ok()).toBeTruthy();
  const sourceData = (await source.json()) as {
    sourceUrl: string;
    hlsUrl: string | null;
    dashUrl: string | null;
  };
  expect(sourceData.sourceUrl.length).toBeGreaterThan(0);
  expect(sourceData.hlsUrl || sourceData.dashUrl || sourceData.sourceUrl).toBeTruthy();

  const home = await request.get(`${webBaseUrl}/`);
  expect(home.ok()).toBeTruthy();
});

