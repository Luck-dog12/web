import { expect, test } from '@playwright/test';

test('admin page and metrics endpoint', async ({ request }) => {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3401';
  const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3400';

  const adminPage = await request.get(`${webBaseUrl}/admin`);
  expect(adminPage.ok()).toBeTruthy();

  const metricsBefore = await request.get(`${apiBaseUrl}/metrics`);
  expect(metricsBefore.ok()).toBeTruthy();
  const beforeData = (await metricsBefore.json()) as { clientEvents?: unknown[] };
  const beforeCount = beforeData.clientEvents?.length ?? 0;

  const trackRes = await request.post(`${apiBaseUrl}/metrics/event`, {
    data: { name: 'retention' },
  });
  expect(trackRes.ok()).toBeTruthy();

  const metricsAfter = await request.get(`${apiBaseUrl}/metrics`);
  expect(metricsAfter.ok()).toBeTruthy();
  const afterData = (await metricsAfter.json()) as { clientEvents?: unknown[] };
  const afterCount = afterData.clientEvents?.length ?? 0;
  expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
});
