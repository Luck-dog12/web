async function main() {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const before = await fetch(`${apiBaseUrl}/metrics`).then((r) => r.json());
  await fetch(`${apiBaseUrl}/metrics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'retention' }),
  });
  const after = await fetch(`${apiBaseUrl}/metrics`).then((r) => r.json());
  const beforeCount = Array.isArray(before.clientEvents) ? before.clientEvents.length : 0;
  const afterCount = Array.isArray(after.clientEvents) ? after.clientEvents.length : 0;
  if (afterCount < beforeCount + 1) {
    throw new Error('metrics verification failed');
  }
  console.log('metrics verification passed');
}

main();
