import { test, expect } from '@playwright/test';

function getProviderOrderId(redirectUrl: string) {
  try {
    return new URL(redirectUrl).searchParams.get('token');
  } catch {
    return null;
  }
}

test('browse → checkout handoff', async ({ request }) => {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
  const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

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
  if (paypalCheckout.status() === 503) {
    const checkoutData = (await paypalCheckout.json()) as { message?: string };
    expect(checkoutData.message).toContain('PayPal checkout is not configured');
    return;
  }
  expect(paypalCheckout.ok()).toBeTruthy();
  const paypalData = (await paypalCheckout.json()) as {
    orderId: string;
    providerOrderId?: string;
    redirectUrl: string;
  };
  expect(paypalData.orderId.length).toBeGreaterThan(0);
  expect(
    paypalData.providerOrderId?.length ?? getProviderOrderId(paypalData.redirectUrl)?.length ?? 0,
  ).toBeGreaterThan(0);
  expect(paypalData.redirectUrl.length).toBeGreaterThan(0);

  const home = await request.get(`${webBaseUrl}/`);
  expect(home.ok()).toBeTruthy();
});
