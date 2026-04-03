import { APIRequestContext, expect, test } from '@playwright/test';

type CourseDetailResponse = {
  course: {
    id: string;
    videos: Array<{ id: string }>;
  };
};

type CourseListResponse = {
  courses: Array<{ id: string }>;
};

async function findCourseWithVideo(
  apiBaseUrl: string,
  request: APIRequestContext,
) {
  const list = await request.get(`${apiBaseUrl}/catalog/courses`);
  expect(list.ok()).toBeTruthy();

  const data = (await list.json()) as CourseListResponse;
  for (const course of data.courses) {
    const detail = await request.get(`${apiBaseUrl}/catalog/courses/${course.id}`);
    if (!detail.ok()) continue;
    const detailData = (await detail.json()) as CourseDetailResponse;
    if (detailData.course.videos.length > 0) {
      return detailData.course.id;
    }
  }

  throw new Error(
    'No published course with at least one video is available. Import or seed one before running this E2E.',
  );
}

test('checkout -> entitlement -> playback', async ({ page, request }) => {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3401';
  const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3400';
  const courseId = await findCourseWithVideo(apiBaseUrl, request);
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'password123';

  const health = await request.get(`${apiBaseUrl}/health`);
  expect(health.ok()).toBeTruthy();

  const register = await request.post(`${apiBaseUrl}/auth/register`, {
    data: { email, password },
  });
  expect(register.ok()).toBeTruthy();

  await page.goto(`${webBaseUrl}/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
  await page.locator('input[placeholder="you@example.com"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button.action-primary').click();
  await page.waitForURL(`**/courses/${courseId}`);
  await expect(page.locator('h1')).toBeVisible();

  const redirectUrl = await page.evaluate(
    async ({ courseId, apiBaseUrl }) => {
      const response = await fetch(`${apiBaseUrl}/payment/checkout/${courseId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: 'paypal', currency: 'USD' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data?.message === 'string' ? data.message : 'Failed to create checkout');
      }

      const data = (await response.json()) as { redirectUrl: string };
      return data.redirectUrl;
    },
    { courseId, apiBaseUrl },
  );

  await page.goto(redirectUrl);
  await page.waitForURL('**/approve?token=*');
  await page.getByRole('button', { name: 'Approve payment' }).click();
  await page.waitForURL(`**/checkout/success?courseId=${courseId}*`);

  const watchLink = page.locator(`a[href="/watch/${courseId}"]`).first();
  await expect(watchLink).toBeVisible();

  const playbackResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiBaseUrl}/playback/source/${courseId}` &&
      response.request().method() === 'GET',
  );

  await watchLink.click();
  await page.waitForURL(`**/watch/${courseId}`);

  const response = await playbackResponse;
  expect(response.ok()).toBeTruthy();

  const iframe = page.locator('iframe[title="Cloudflare Stream player"]');
  const video = page.locator('video');
  await expect
    .poll(async () => (await iframe.count()) + (await video.count()), {
      message: 'expected watch page to render a playback surface',
    })
    .toBeGreaterThan(0);

  if ((await iframe.count()) > 0) {
    await expect(iframe.first()).toBeVisible();
    return;
  }

  await expect(video.first()).toBeVisible();
});
